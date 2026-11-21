import store from "../redux/store/index";
import { parseGameData, parseEnmity, parseAggroList, parseParty, parseLogLine, updateState } from "../redux/actions/index";
import Constants from "../constants";
import SkillData from "../constants/SkillData";
import SpellService from "../services/SpellService";
import TTSService from "../services/TTSService";

class MessageProcessor {
	activity_epoch = null;
	activity_actions = new Set();
	activity_statuses = new Map();
	activity_snapshot = null;
	activity_context = null;

	processActivity = detail => {
		if (!detail || !Number.isSafeInteger(detail.epoch) || !Number.isFinite(detail.publishedAt) || !Array.isArray(detail.actors) ||
			!Array.isArray(detail.actions) || !Array.isArray(detail.statuses)) {
			return;
		}

		if (!this.activity_snapshot) {
			store.subscribe(() => {
				const state = store.getState();
				if (this.activityContext(state) !== this.activity_context) {
					this.applyActivity(state);
				}
			});
		}

		this.activity_snapshot = detail;
		this.applyActivity(store.getState());
	};

	activityContext({ settings, internal }) {
		return `${Boolean(settings.spells_mode)}:${internal.character_id}:${internal.mode}`;
	}

	applyActivity(state) {
		const detail          = this.activity_snapshot;
		this.activity_context = this.activityContext(state);
		if (!state.settings.spells_mode || (state.internal.character_id === null && detail.actors.length)) {
			return;
		}

		const self_id = state.internal.character_id;
		const actors  = new Map(detail.actors.map(actor => [actor.id, actor]));
		const self    = actors.get(self_id);

		if (this.activity_epoch !== detail.epoch) {
			this.activity_epoch = detail.epoch;
			this.activity_actions.clear();
			this.activity_statuses.clear();
			TTSService.resetActivityResources();
			store.dispatch({ type : "resetActivity" });
		}

		if (self) {
			const job = Constants.GameJobsID[self.classJob]?.abbreviation;
			if (job && job !== state.internal.character_job) {
				store.dispatch(updateState({ key : "internal.character_job", value : job }));
			}

			if (Number.isInteger(self.level) && self.level !== state.internal.character_level) {
				store.dispatch(updateState({ key : "internal.character_level", value : self.level }));
			}
		}

		if (detail.party && Array.isArray(detail.party.members)) {
			const party = detail.party.members.filter(member => member.ownParty);
			const names = detail.party.isInParty ? party.map(member => member.name) : [];

			if (names.length !== state.internal.party.length || names.some((name, index) => name !== state.internal.party[index])) {
				store.dispatch(updateState({ key : "internal.party", value : names }));
			}

			const counts = new Map();
			for (const name of names) {
				counts.set(name, (counts.get(name) || 0) + 1);
			}

			TTSService.resetActivityResources(["YOU", ...names.filter(name => counts.get(name) === 1)]);

			if (state.internal.mode === "stats") {
				for (const { id } of party) {
					const actor = actors.get(id);
					if (id !== self_id && actor && counts.get(actor.name) === 1) {
						TTSService.processActivityResources(actor, false, state);
					}
				}
			}
		}

		if (state.internal.mode === "stats" && self) {
			TTSService.processActivityResources(self, true, state);
		}

		if (state.internal.mode === "spells" && self_id !== null) {
			this.processActivitySpells(detail, actors, self_id, self?.level);
		}
	}

	processActivitySpells(detail, actors, self_id, self_level) {
		const now  = Date.now();
		const seen = new Set();

		for (const { key, actorId, actionId, ageMs } of detail.actions) {
			const age = now - detail.publishedAt + ageMs;
			if (!actors.has(actorId) || !Number.isFinite(age) || ageMs < 0 || age < 0 || age >= 10000) {
				continue;
			}

			const id     = String(actionId);
			const level  = actorId === self_id ? self_level : 0;
			const recast = Math.max(SpellService.getSkillRecast(id, level) || 0,
				SpellService.getSkillRecast(SkillData.SkillIndirections[id], level) || 0);

			if (!recast || age >= recast * 1000) {
				continue;
			}

			seen.add(key);
			if (!this.activity_actions.has(key)) {
				store.dispatch({
					type    : "applyActivitySpell",
					payload : {
						id, type       : "skill", char_id    : actorId, class_job  : actors.get(actorId).classJob,
						date       : new Date(now - age), structured : true,
					},
				});
			}
		}

		this.activity_actions = seen;
		const current         = new Map();

		for (const { actorId, items } of detail.statuses) {
			if (items === null) {
				for (const [key, status] of this.activity_statuses) {
					if (status.actor_id === actorId && status.ends_at > now) {
						current.set(key, status);
					}
				}

				continue;
			}

			for (const { slot, statusId, sourceActorId, param, remainingMs } of items) {
				const id      = String(statusId);
				const effect  = SkillData.Effects[id];
				const char_id = effect?.dot || effect?.debuff ? sourceActorId : actorId;

				if (!effect || !actors.has(char_id)) {
					continue;
				}

				const key = `${actorId}:${slot ?? "-"}:${id}:${sourceActorId}`;
				if (remainingMs === null) {
					const previous = this.activity_statuses.get(key);
					if (previous?.ends_at > now) {
						current.set(key, previous);
					}

					continue;
				}

				const ends_at = detail.publishedAt + remainingMs;
				if (!Number.isFinite(ends_at) || ends_at <= now) {
					continue;
				}

				current.set(key, {
					type       : "effect",
					id,
					char_id,
					actor_id   : actorId,
					class_job  : actors.get(char_id).classJob,
					date       : new Date(detail.publishedAt),
					duration   : remainingMs / 1000,
					ends_at,
					stacks     : param % 256,
					structured : true,
					status_key : key,
				});
			}
		}

		let removed = false;
		for (const [key, status] of this.activity_statuses) {
			if (!current.has(key)) {
				removed = true;
				store.dispatch({ type : "applyActivitySpell", payload : { ...status, removed : true } });
			}
		}

		for (const [key, status] of current) {
			const previous = this.activity_statuses.get(key);
			if (removed || previous?.ends_at !== status.ends_at || previous.stacks !== status.stacks ||
				previous.class_job !== status.class_job) {
				store.dispatch({ type : "applyActivitySpell", payload : status });
			}
		}

		this.activity_statuses = current;
	}

	processMessage(e) {
		let data = e;
		let type = false;

		if (typeof data !== "object" || (data !== null && data.data)) {
			try {
				data = JSON.parse(e.data);
			} catch {}
		}

		if (typeof data !== "object" || data === null) {
			if (data) {
				try {
					data = JSON.parse(data);

					if (data.combatants) {
						type = "GetCombatants";
					}
				} catch {}
			}

			if (!type) {
				return;
			}
		}

		type = type || data.msgtype || data.type;

		if (
			[
				"onOverlayDataUpdate",
				"SendCharName",
				"CombatData",
				"EnmityAggroList",
				"EnmityTargetData",
				"ChangePrimaryPlayer",
				"PartyChanged",
				"LogLine",
				"GetCombatants",
				"ChangeZone",
			].indexOf(type) === -1
		) {
			return;
		}

		let state_data;

		switch (type) {
			case "onOverlayDataUpdate":
			case "CombatData":
				const detail = (type === "onOverlayDataUpdate") ? data.detail : data.msg || data;

				store.dispatch(parseGameData(detail));
				break;

			case "EnmityAggroList":
				if (data.AggroList && !data.AggroList.length) {
					break;
				}

				store.dispatch(parseAggroList(data));
				break;

			case "EnmityTargetData":
				if (!data.Entries || !data.Entries.length) {
					break;
				}

				store.dispatch(parseEnmity(data));
				break;

			case "ChangePrimaryPlayer":
			case "SendCharName":
				state_data = {
					key : [
						"internal.character_name",
						"internal.character_id",
					],
					value : [
						(type === "ChangePrimaryPlayer") ? data.charName : data.msg.charName,
						(type === "ChangePrimaryPlayer") ? data.charID : data.msg.charID,
					],
				};

				store.dispatch(updateState(state_data));
				break;

			case "ChangeZone":
				state_data = {
					key   : "internal.current_zone_id",
					value : data.zoneID,
				};

				store.dispatch(updateState(state_data));
				break;

			case "GetCombatants":
				const char_id = store.getState().internal.character_id;

				for (const combatant of data.combatants) {
					if (char_id === combatant.ID) {
						const job = Constants.GameJobsID[combatant.Job];

						if (!job) {
							break;
						}

						state_data = {
							key : [
								"internal.character_job",
								"internal.character_level",
							],
							value : [
								job.abbreviation,
								combatant.Level,
							],
						};

						store.dispatch(updateState(state_data));
						break;
					}
				}

				break;

			case "PartyChanged":
				store.dispatch(parseParty(data));
				break;

			case "LogLine":
				const allowed_codes = [1, 3, 21, 22, 26, 30, 33, 37, 39];

				if (allowed_codes.indexOf(Number(data.line[0])) === -1) {
					break;
				}

				store.dispatch(parseLogLine(data));
				break;

			default:
				break;
		}
	}
}

export default new MessageProcessor();
