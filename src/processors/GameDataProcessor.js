import store from "../redux/store/index";
import clone from "lodash.clonedeep";

import Constants from "../constants/index";
import SkillData from "../constants/SkillData";
import PlayerProcessor from "./PlayerProcessor";

import LocalizationService from "../services/LocalizationService";
import TTSService from "../services/TTSService";
import UsageService from "../services/UsageService";
import SpellService from "../services/SpellService";

import { createUUID } from "../helpers/UUIDHelper";

class GameDataProcessor {
	normalizeFieldLocale(value) {
		const foreign_number_regex = /[\d]+,[\d]{2}(%|K)?$/;
		const matches              = String(value).match(foreign_number_regex);
		const match                = (matches && matches.length) ? matches[0] : false;

		if (match === false) {
			return value;
		}

		return value.replace(match, String(match).replace(",", "."));
	}

	normalizeLocales(data, language, current_state, loading_sample) {
		if (data.Encounter) {
			return this.normalizeGameData(data, language, current_state, loading_sample);
		}

		if (data.AggroList) {
			return this.normalizeAggroList(data);
		}

		return data;
	}

	normalizeGameData(data, language, current_state, loading_sample) {
		data.Encounter.name             = LocalizationService.getOverlayText("encounter", language);
		data.Encounter.Job              = "ENC";
		data.Encounter.OverHealPct      = "0%";
		data.Encounter.BlockPct         = "0%";
		data.Encounter.DirectHitPct     = "0%";
		data.Encounter.CritDirectHitPct = "0%";
		data.Encounter["damage%"]       = "100%";
		data.Encounter["healed%"]       = "100%";

		for (const key in Constants.PlayerDataTitles) {
			if (data.Encounter[key] !== undefined) {
				data.Encounter[key] = this.normalizeFieldLocale(data.Encounter[key]);
			}
		}

		for (const player_name in data.Combatant) {
			for (const key in Constants.PlayerDataTitles) {
				if (data.Combatant[player_name][key] !== undefined) {
					data.Combatant[player_name][key] = this.normalizeFieldLocale(data.Combatant[player_name][key]);
				}
			}

			if ((data.Combatant[player_name].Job || "").toLowerCase() === "limit break") {
				data.Combatant[player_name].Job = "LMB";
			}

			data.Combatant[player_name].UUID = createUUID();
		}

		data = this.injectMaxDPS(data, current_state, loading_sample);

		return data;
	}

	injectMaxDPS(data, current_state, loading_sample) {
		if (!current_state || !UsageService.usingMaxDPS(current_state.settings_data)) {
			return data;
		}

		const can_calculate_max = (!loading_sample && data.Encounter.DURATION >= 30);

		for (const player_name in data.Combatant) {
			data.Combatant[player_name].max_enc_dps = data.Combatant[player_name].max_enc_dps || 0;

			if (can_calculate_max && (!current_state || !current_state.internal.game.Combatant || !current_state.internal.game.Combatant[player_name] || Number(data.Combatant[player_name].encdps) > current_state.internal.game.Combatant[player_name].max_enc_dps)) {
				data.Combatant[player_name].max_enc_dps = Number(data.Combatant[player_name].encdps);
			} else if (current_state && current_state.internal.game.Combatant && current_state.internal.game.Combatant[player_name]) {
				data.Combatant[player_name].max_enc_dps = current_state.internal.game.Combatant[player_name].max_enc_dps || 0;
			}
		}

		return data;
	}

	normalizeAggroList(data) {
		for (const key of ["CurrentHP", "MaxHP"]) {
			for (const i in data.AggroList) {
				if (data.AggroList[i][key] !== undefined) {
					data.AggroList[i][key] = this.normalizeFieldLocale(data.AggroList[i][key]);
				}
			}
		}

		return data.AggroList;
	}

	appendHistory(data, state) {
		if (!data.Encounter) {
			return;
		}

		const interval = 15;

		const current_history = state.internal.encounter_history[0].data_history;
		const recent_time     = Object.keys(current_history).slice(-1)[0];
		const current_time    = Math.round(new Date().getTime() / 1000);

		if (recent_time && (current_time - recent_time) < interval) {
			return;
		}

		const new_data  = {};
		const encounter = JSON.parse(JSON.stringify(data.Encounter));

		new_data.Encounter = {
			encdps : PlayerProcessor.getDataValue("encdps", encounter, undefined, undefined, true, state),
			enchps : PlayerProcessor.getDataValue("enchps", encounter, undefined, undefined, true, state),
			enctps : PlayerProcessor.getDataValue("enctps", encounter, undefined, encounter, true, state),
		};

		for (const player_name in data.Combatant) {
			const player = JSON.parse(JSON.stringify(data.Combatant[player_name]));

			new_data[player_name] = {
				encdps : PlayerProcessor.getDataValue("encdps", player, undefined, undefined, true, state),
				enchps : PlayerProcessor.getDataValue("enchps", player, undefined, undefined, true, state),
				enctps : PlayerProcessor.getDataValue("enctps", player, undefined, encounter, true, state),
			};
		}

		current_history[current_time] = new_data;

		state.internal.encounter_history[0].data_history = current_history;
	}

	processEnmity(data) {
		for (const i in data.Entries) {
			data.Entries[i].name = data.Entries[i].Name;
		}

		const sorted_players = PlayerProcessor.sortPlayers(data.Entries, undefined, "Enmity");
		let max_value        = 0;
		const players        = {};

		for (const player of sorted_players) {
			if (!max_value) {
				max_value = player.Enmity || 100;
			}

			const percent = ((player.Enmity / max_value) * 100).toFixed(2);

			players[player.Name] = percent;
		}

		return players;
	}

	injectEnmity(data, state) {
		for (let player_name in data.Combatant) {
			const real_player_name = player_name;

			if (player_name === "YOU") {
				player_name = PlayerProcessor.getDataValue("name", data.Combatant[player_name], undefined, undefined, undefined, state);
			}

			data.Combatant[real_player_name].enmity_percent = state.internal.enmity[player_name] || 0;
		}

		return data;
	}

	processParty(data) {
		const party = [];

		if (!data || !data.party) {
			return party;
		}

		for (const i in data.party) {
			if (data.party[i].inParty) {
				party.push(data.party[i].name);
			}
		}

		return party;
	}

	convertToLocaleFormat(key, value, state) {
		state = state || store.getState();

		const accuracy          = state.settings.interface.decimal_accuracy;
		const shorten_thousands = state.settings.interface.shorten_thousands;
		let over_thousand       = false;
		const fraction_rules    = Constants.PlayerMetricFractionRules[key];
		const minimum_fraction  = (fraction_rules && "min" in fraction_rules) ? fraction_rules.min : accuracy;
		const maximum_fraction  = (fraction_rules && "max" in fraction_rules) ? fraction_rules.max : accuracy;

		value = Number(value);

		if (shorten_thousands && value >= 1000) {
			value         = Number((value / 1000).toFixed(2));
			over_thousand = true;
		}

		value = value.toLocaleString(undefined, { minimumFractionDigits : minimum_fraction, maximumFractionDigits : maximum_fraction });

		if (over_thousand) {
			value += "K";
		}

		return value;
	}

	processCombatDataTTS(data, current_state) {
		const valid_player_names = PlayerProcessor.getValidPlayerNames(current_state);

		if (data.Combatant) {
			TTSService.updateCombatants(data.Combatant, valid_player_names);
		}

		TTSService.processEncounter(data, current_state);

		if (!data.Encounter) {
			return;
		}

		if (UsageService.usingTopDPSTTS(current_state.settings_data)) {
			const sorted = PlayerProcessor.sortPlayers(data.Combatant, data.Encounter, "encdps", current_state);
			let rank     = 0;

			for (const player of sorted) {
				rank++;

				if (valid_player_names.indexOf(player.name) !== -1) {
					TTSService.processRank(rank, "dps", current_state);
					break;
				}
			}
		}

		if (UsageService.usingTopHPSTTS(current_state.settings_data)) {
			const sorted = PlayerProcessor.sortPlayers(data.Combatant, data.Encounter, "enchps", current_state);
			let rank     = 0;

			for (const player of sorted) {
				rank++;

				if (valid_player_names.indexOf(player.name) !== -1) {
					TTSService.processRank(rank, "hps", current_state);
					break;
				}
			}
		}

		if (UsageService.usingTopTPSTTS(current_state.settings_data)) {
			const sorted = PlayerProcessor.sortPlayers(data.Combatant, data.Encounter, "enctps", current_state);
			let rank     = 0;

			for (const player of sorted) {
				rank++;

				if (valid_player_names.indexOf(player.name) !== -1) {
					TTSService.processRank(rank, "tps", current_state);
					break;
				}
			}
		}
	}

	processAggroTTS(data, current_state) {
		if (UsageService.usingAggroTTS(current_state.settings_data)) {
			TTSService.processAggro(data);
		}
	}

	parseSpellLogLine({ line }, state) {
		const code    = Number(line[0]);
		const char_id = parseInt(line[2], 16);
		const date    = new Date();

		switch (code) {
			case 3:
				return char_id === state.internal.character_id && {
					char_job   : Constants.GameJobsID[parseInt(line[4], 16)] || null,
					char_level : parseInt(line[5], 16),
				};

			case 21:
			case 22:
				return this.processSpellInput({
					type      : "skill", id        : String(parseInt(line[4], 16)), char_id,
					char_name : line[3], name      : line[5], date,
				}, state);

			case 26:
			case 30: {
				const id          = String(parseInt(line[2], 16));
				const effect      = SkillData.Effects[id];
				const actor_index = effect?.dot || effect?.debuff ? 5 : 7;

				return this.processSpellInput({
					type      : "effect", id, char_id   : parseInt(line[actor_index], 16),
					char_name : line[actor_index + 1], name      : line[3], date,
					duration  : Number(line[4]), stacks    : Number(line[9]), removed   : code === 30,
				}, state);
			}

			case 33:
				return line[3] === "40000005" ? "wipe" : false;

			default:
				return false;
		}
	}

	processSpellInput(input, state, processed_state) {
		const { type, id, char_id, char_name, name, date, duration = 0, stacks, removed, status_key } = input;
		const effect                                                                                  = SkillData.Effects[id];

		if (type === "effect" ? !effect : !SpellService.skillExists(id)) {
			return false;
		}

		const subtype      = effect && type === "effect" ? (effect.dot ? "dot" : effect.debuff ? "debuff" : "effect") : "skill";
		const log_data     = {
			type, subtype, char_id, stacks, spell_id   : id,
			lookup_key : subtype === "skill" ? "spells" : subtype + "s",
		};
		log_data.char_type = (state.internal.character_id === log_data.char_id) ? "you" : false;
		log_data.party     = (log_data.char_type !== "you");

		if (
			log_data.party &&
			state.settings.spells_mode.party_zones.length &&
			state.settings.spells_mode.party_zones.indexOf(String(state.internal.current_zone_id)) === -1
		) {
			return false;
		}

		if (!log_data.char_type) {
			const job = input.structured
				? Constants.GameJobsID[input.class_job]?.abbreviation
				: state.internal.game.Combatant?.[char_name]?.Job;

			log_data.job = (job || "").toUpperCase();

			if (!Constants.GameJobs[log_data.job]) {
				return false;
			}

			log_data.char_type  = (state.settings.spells_mode.ui.use) ? Constants.GameJobs[log_data.job].role : "party";
			log_data.lookup_key = "party_" + log_data.lookup_key;
			log_data.suffix     = "party";
		}

		if (
			!state.internal.spells.allowed_types[log_data.subtype][log_data.char_type] &&
			!state.internal.spells.allowed_types[log_data.subtype][log_data.job]
		) {
			return false;
		}

		if (log_data.type === "effect") {
			log_data.english_name = LocalizationService.getSpellName(log_data.subtype, log_data.spell_id, "en");

			if (!SpellService.isValidName(log_data.lookup_key, log_data.english_name)) {
				return false;
			}
		} else {
			if (state.settings.spells_mode[log_data.lookup_key].indexOf(log_data.spell_id) === -1) {
				if (this.isValidIndirection(log_data)) {
					return this.processIndirection(input, state);
				}

				return false;
			}

			log_data.english_name = LocalizationService.getSpellName(log_data.subtype, log_data.spell_id, "en");
		}

		const state_data    = processed_state || clone(state.internal.spells);
		const defaulted_key = `${log_data.subtype}-` + SpellService.getKeyName(log_data.english_name);
		const suffixes      = [];

		if (!log_data.party) {
			suffixes.push("");
		} else {
			if (state.internal.spells.allowed_types[log_data.subtype][log_data.char_type]) {
				suffixes.push(log_data.char_type);
			}

			if (state.settings.spells_mode.ui.use && state.internal.spells.allowed_types[log_data.subtype][log_data.job]) {
				suffixes.push(log_data.job);
			}
		}

		log_data.in_use_key = (log_data.type === "effect")
			? `${log_data.type}-` + SpellService.getKeyName(log_data.english_name)
			: `${log_data.type}-${log_data.spell_id}`;

		if (!log_data.party && state_data.defaulted[defaulted_key]) {
			const defaulted = state_data.defaulted[defaulted_key];

			if (removed && status_key && state_data.in_use[defaulted.key]?.status_key !== status_key) {
				return false;
			}

			log_data.defaulted     = true;
			log_data.type_position = defaulted.position;

			if (defaulted.id !== log_data.spell_id) {
				if (removed) {
					state_data.in_use[log_data.in_use_key] = clone(state_data.in_use[defaulted.key]);

					state_data.in_use[log_data.in_use_key].spell_id = log_data.spell_id;
					state_data.in_use[log_data.in_use_key].duration = 0;
				}

				delete state_data.in_use[defaulted.key];

				state_data.defaulted[defaulted_key].id  = log_data.spell_id;
				state_data.defaulted[defaulted_key].key = log_data.in_use_key;

				if (removed) {
					return state_data;
				}
			}
		}

		for (const suffix of suffixes) {
			log_data.current_in_use_key = log_data.in_use_key;

			if (suffix) {
				log_data.current_in_use_key += `-${suffix}`;

				if (suffix !== "party") {
					log_data.char_type = suffix;
				}
			}

			const previous = state_data.in_use[log_data.current_in_use_key];

			if (removed) {
				if (!status_key || previous?.status_key === status_key) {
					delete state_data.in_use[log_data.current_in_use_key];
				}
			} else {
				if (status_key && previous?.status_key) {
					const deadline = date.getTime() + (duration * 1000);
					const change   = deadline - (previous.time.getTime() + (previous.duration * 1000));

					if (previous.status_key === status_key ? Math.abs(change) < 300 && previous.stacks === stacks : change <= 0) {
						continue;
					}
				} else if (previous && Number(previous.stacks) > stacks) {
					return false;
				}

				state_data.in_use[log_data.current_in_use_key] = {
					type          : log_data.type,
					subtype       : log_data.subtype,
					id            : log_data.spell_id,
					time          : date,
					name,
					duration,
					stacks        : log_data.stacks,
					log_type      : log_data.char_type + "-" + log_data.subtype,
					party         : log_data.party,
					defaulted     : log_data.defaulted,
					type_position : log_data.type_position,
					...(status_key ? { status_key } : {}),
				};
			}
		}

		if (this.isValidIndirection(log_data)) {
			const result = this.processIndirection(input, state, state_data);
			return result || (input.structured ? state_data : false);
		}

		return state_data;
	}

	isValidIndirection(log_data) {
		return (log_data.type === "skill" && SkillData.SkillIndirections[log_data.spell_id]);
	}

	processIndirection(input, state, processed_state) {
		const id = String(SkillData.SkillIndirections[input.id]);

		return this.processSpellInput({ ...input, id, name : null }, state, processed_state);
	}

	getAllowedSpellTypes(state) {
		const types = {
			skill : {
				you   : true,
				party : true,
			},
			effect : {
				you   : true,
				party : true,
			},
			dot : {
				you   : true,
				party : true,
			},
			debuff : {
				you   : true,
				party : true,
			},
		};

		if (state.settings.spells_mode.ui.use) {
			types.skill.you    = false;
			types.effect.you   = false;
			types.dot.you      = false;
			types.debuff.you   = false;
			types.skill.party  = false;
			types.effect.party = false;
			types.debuff.party = false;

			for (const uuid in state.settings.spells_mode.ui.sections) {
				const section = state.settings.spells_mode.ui.sections[uuid];

				for (const type of section.types) {
					const data = type.split("-");

					types[data[1]][data[0]] = true;
				}
			}
		}

		return types;
	}
}

export default new GameDataProcessor();
