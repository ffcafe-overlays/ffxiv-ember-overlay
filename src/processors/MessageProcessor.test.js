/* eslint-env jest */
import store from "../redux/store";
import MessageProcessor from "./MessageProcessor";

jest.mock("../redux/store", () => ({ dispatch : jest.fn(), getState : jest.fn(), subscribe : jest.fn() }));
jest.mock("../services/SpellService", () => ({ getSkillRecast : id => id === "3" ? 60 : 0 }));
jest.mock("../services/TTSService", () => ({ resetActivityResources : jest.fn() }));

const ready        = {
	settings : { spells_mode : {} },
	internal : { character_id : 16, character_job : "WAR", character_level : 100, mode : "spells" },
};
const timed_status = { slot : 3, statusId : 1177, sourceActorId : 16, param : 3 };
const makeFrame    = (epoch, items) => ({
	epoch,
	publishedAt : 20000,
	actors      : [{ id : 16, classJob : 21, level : 100 }],
	actions     : [],
	statuses    : [{ actorId : 16, items }],
});

beforeEach(() => {
	store.dispatch.mockClear();
	store.getState.mockReturnValue(ready);
});

afterEach(() => jest.restoreAllMocks());

test("a new document applies an older retained frame once its settings and character are ready", () => {
	const clock = jest.spyOn(Date, "now").mockReturnValue(24300);
	store.getState.mockReturnValue({ ...ready, settings : {}, internal : { ...ready.internal, character_id : null } });
	const detail   = makeFrame(1, [{ ...timed_status, remainingMs : 12000 }]);
	detail.actions = [
		{ key : "16:0", actorId : 16, actionId : 3, ageMs : 1500 },
		{ key : "16:1", actorId : 16, actionId : 3, ageMs : 6000 },
	];

	MessageProcessor.processActivity(detail);
	expect(store.dispatch).not.toHaveBeenCalled();

	const update = store.subscribe.mock.calls[0][0];
	store.getState.mockReturnValue({ ...ready, internal : { ...ready.internal, character_id : null } });
	update();
	expect(store.dispatch).not.toHaveBeenCalled();
	store.getState.mockReturnValue(ready);
	update();

	const spells = store.dispatch.mock.calls.map(([action]) => action.payload).filter(Boolean);
	expect(spells).toHaveLength(2);
	expect(spells[0].date.getTime()).toBe(18500);
	expect(spells[1]).toMatchObject({ id : "1177", ends_at : 32000 });

	clock.mockReturnValue(28000);
	MessageProcessor.processActivity(detail);
	expect(store.dispatch).toHaveBeenCalledTimes(3);
});

test("equivalent status deadlines leave the timer alone and a small refresh is applied", () => {
	jest.spyOn(Date, "now").mockReturnValue(23000);
	const detail = makeFrame(2, [{ ...timed_status, remainingMs : 15000 }]);

	MessageProcessor.processActivity(detail);
	expect(store.dispatch).toHaveBeenCalledTimes(2);

	const later = { ...detail, publishedAt : 22500 };
	MessageProcessor.processActivity({ ...later, statuses : [{ actorId : 16, items   : [
		{ ...timed_status, remainingMs : 12500 },
	] }] });
	expect(store.dispatch).toHaveBeenCalledTimes(2);

	MessageProcessor.processActivity({ ...later, statuses : [{ actorId : 16, items   : [
		{ ...timed_status, remainingMs : 12600 },
	] }] });
	expect(store.dispatch).toHaveBeenCalledTimes(3);
	expect(store.dispatch.mock.calls.at(-1)[0].payload.ends_at).toBe(35100);
});

test("an unknown duration keeps the current countdown until removal and an expired status cannot restart it", () => {
	const clock   = jest.spyOn(Date, "now").mockReturnValue(23000);
	const publish = items => MessageProcessor.processActivity(makeFrame(3, items));
	const last    = () => store.dispatch.mock.calls.at(-1)[0].payload;

	publish([{ ...timed_status, remainingMs : 12500 }]);
	const timed = last();
	expect(timed).toMatchObject({ id : "1177", duration : 12.5, stacks : 3, ends_at : 32500 });
	publish([{ ...timed_status, remainingMs : null }]);
	expect(last()).toBe(timed);
	clock.mockReturnValue(32500);
	publish([]);
	expect(last()).toMatchObject({ id : "1177", removed : true });
	publish([{ ...timed_status, remainingMs : 12500 }]);
	expect(store.dispatch).toHaveBeenCalledTimes(3);
});

test("dispatches independent nonempty enmity tables once and preserves the last visible rows on empty input", () => {
	store.getState.mockReturnValue({ settings : {}, internal : { mode : "stats", encounter_history : [{}] }, settings_data : { getSetting : () => ["enmity_percent"] } });
	const frame  = { ...makeFrame(90, []), actors : [], statuses : [] };
	const enmity = { Entries : [{ Name : "One", Enmity : 8000 }, { Name : "Two", Enmity : 160 }] };
	const aggro  = { AggroList : [{ ID : 45, Name : "Enemy", Target : { ID : 16, isMe : false } }] };
	MessageProcessor.processActivity({ ...frame, enmity, aggro });
	MessageProcessor.processActivity({ ...frame, publishedAt : 20010, enmity, aggro });
	MessageProcessor.processActivity({ ...frame, enmity : { Entries : [] }, aggro });
	expect(store.dispatch.mock.calls.map(([a]) => a.type)).toEqual(["parseEnmity", "parseAggroList"]);
	const changed = { AggroList : [{ ...aggro.AggroList[0], Target : { ID : 17, isMe : true } }] };
	MessageProcessor.processActivity({ ...frame, aggro : changed });
	MessageProcessor.processActivity({ ...frame, aggro : changed });
	expect(store.dispatch.mock.calls.map(([a]) => a.type)).toEqual(["parseEnmity", "parseAggroList", "parseAggroList"]);
});

test("retries retained enmity once the first combat report creates its encounter", () => {
	MessageProcessor.activity_snapshot = null;
	const state                        = { settings : {}, internal : { mode : "stats", encounter_history : [] }, settings_data : { getSetting : () => ["enmity_percent"] } };
	store.getState.mockReturnValue(state);
	const frame = { ...makeFrame(91, []), actors : [], statuses : [], enmity : { Entries : [{ Name : "One", Enmity : 250 }] } };
	MessageProcessor.processActivity(frame);
	expect(store.dispatch).not.toHaveBeenCalled();
	state.internal.encounter_history.push({});
	store.subscribe.mock.calls[0][0]();
	expect(store.dispatch.mock.calls.map(([a]) => a.type)).toEqual(["parseEnmity"]);
});
