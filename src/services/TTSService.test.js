/* eslint-env jest */
import TTSService from "./TTSService";

jest.mock("../redux/store", () => ({ getState : jest.fn() }));
jest.mock("./UsageService", () => ({ usingLogTTS : () => true }));

test("structured warnings preserve first low, repeated low, unknown, and recovery behavior", () => {
	TTSService.updateRules({ critical_hp : { tank : 30 }, critical_mp : { all : 20 } });
	TTSService.resetActivityResources();
	const sample = { id : 16, name : "Example Player", classJob : 21, hpCur : 0, hpMax : 100, mpCur : 0, mpMax : 100 };
	const state  = { settings_data : {} };

	TTSService.processActivityResources(sample, true, state);
	expect(TTSService.queue.critical_hp).toEqual({ YOU : true });
	expect(TTSService.queue.critical_mp).toEqual({ YOU : true });
	TTSService.queue.critical_hp = {};
	TTSService.queue.critical_mp = {};

	TTSService.processActivityResources(sample, true, state);
	TTSService.processActivityResources({ ...sample, hpCur : 50, hpMax : undefined }, true, state);
	TTSService.processActivityResources(sample, true, state);
	expect(TTSService.queue.critical_hp).toEqual({});
	expect(TTSService.queue.critical_mp).toEqual({});

	TTSService.processActivityResources({ ...sample, hpCur : 30, mpCur : 20 }, true, state);
	TTSService.processActivityResources(sample, true, state);
	expect(TTSService.queue.critical_hp).toEqual({ YOU : true });
	expect(TTSService.queue.critical_mp).toEqual({ YOU : true });

	TTSService.resetActivityResources();
	expect(TTSService.state.critical_hp).toEqual([]);
	expect(TTSService.queue.critical_mp).toEqual({});
});

test("queues a named enemy once when it switches from a party member to the local player", () => {
	TTSService.state.aggro = [];
	TTSService.queue.aggro = {};
	const target           = isMe => [{ Name : "Synthetic enemy", Target : { ID : isMe ? 1 : 2, isMe } }];
	TTSService.processAggro([{ Target : { ID : 1, isMe : true } }]);
	expect(TTSService.queue.aggro).toEqual({});
	TTSService.processAggro(target(false));
	expect(TTSService.queue.aggro).toEqual({});
	TTSService.processAggro(target(true));
	expect(TTSService.queue.aggro).toEqual({ "Synthetic enemy" : true });
	TTSService.queue.aggro = {};
	TTSService.processAggro(target(true));
	expect(TTSService.queue.aggro).toEqual({});
});
