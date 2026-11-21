/* eslint-env jest */
import store from "../redux/store";
import MessageProcessor from "./MessageProcessor";

jest.mock("../redux/store", () => ({ dispatch : jest.fn(), getState : jest.fn() }));
jest.mock("../services/SpellService", () => ({ getSkillRecast : id => id === "3" ? 60 : 0 }));
jest.mock("../services/TTSService", () => ({ resetActivityResources : jest.fn() }));

test("the first activity frame applies valid actions once and starts them at their reported age", () => {
	jest.spyOn(Date, "now").mockReturnValue(10000);
	store.getState.mockReturnValue({
		settings : { spells_mode : {} },
		internal : { character_id : 16, character_job : "WAR", character_level : 100, mode : "spells" },
	});
	const detail = {
		epoch   : 1,
		actors  : [{ id : 16, classJob : 21, level : 100 }],
		actions : [
			{ key : "16:0", actorId : 16, actionId : 3, ageMs : 1500 },
			{ key : "16:1", actorId : 16, actionId : 3, ageMs : 10000 },
		],
		statuses : [],
	};

	MessageProcessor.processActivity({ detail });
	MessageProcessor.processActivity({ detail });
	expect(store.dispatch.mock.calls.map(([action]) => action.type)).toEqual(["resetActivity", "applyActivitySpell"]);
	expect(store.dispatch.mock.calls.at(-1)[0].payload.date.getTime()).toBe(8500);

	MessageProcessor.processActivity({ detail : { ...detail, epoch : 2 } });
	expect(store.dispatch.mock.calls.map(([action]) => action.type)).toEqual([
		"resetActivity", "applyActivitySpell", "resetActivity", "applyActivitySpell",
	]);
	jest.restoreAllMocks();
});
