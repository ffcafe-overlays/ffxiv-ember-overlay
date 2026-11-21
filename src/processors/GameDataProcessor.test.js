/* eslint-env jest */
import GameDataProcessor from "./GameDataProcessor";
import SpellService from "../services/SpellService";

jest.mock("../redux/store", () => ({}));

function trackedSpells() {
	const state = {
		settings : { spells_mode : {
			spells        : ["3571"],
			effects       : ["157"],
			dots          : [],
			debuffs       : [],
			party_spells  : [],
			party_effects : [],
			party_dots    : [],
			party_debuffs : [],
		} },
		internal : {
			character_id : 16,
			spells       : {
				in_use        : {},
				defaulted     : {},
				allowed_types : { skill : { you : true }, effect : { you : true } },
			},
		},
	};
	SpellService.updateValidNames(state);
	return state;
}

test.each(["21", "22"])("ACT ability log %s still updates the selected cooldown", code => {
	const event  = { line : [code, "", "10", "Player", "DF3", "Assize"] };
	const spells = GameDataProcessor.parseSpellLogLine(event, trackedSpells());
	expect(spells.in_use["skill-3571"]).toMatchObject({ id : "3571", log_type : "you-skill", name : "Assize" });
});

test("ACT status logs still set the duration and stacks and remove the timer", () => {
	const state   = trackedSpells();
	const applied = ["26", "", "9D", "Presence of Mind", "15", "10", "Player", "10", "Player", "1"];

	state.internal.spells = GameDataProcessor.parseSpellLogLine({ line : applied }, state);
	expect(Object.values(state.internal.spells.in_use)).toEqual([
		expect.objectContaining({ id : "157", duration : 15, stacks : 1 }),
	]);
	const removed = GameDataProcessor.parseSpellLogLine({ line : ["30", ...applied.slice(1)] }, state);
	expect(removed.in_use).toEqual({});
});
