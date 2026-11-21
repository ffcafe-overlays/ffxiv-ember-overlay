/* eslint-env jest */
import MessageProcessor from "../processors/MessageProcessor";
import PluginService from "./PluginService";

jest.mock("../redux/store", () => ({}));
jest.mock("../processors/MessageProcessor", () => ({ processActivity : jest.fn(), processMessage : jest.fn() }));
jest.mock("./UsageService", () => ({
	usingEnmity     : () => true,
	usingLog        : () => true,
	usingCombatData : () => true,
}));

beforeEach(() => {
	window.OverlayPluginApi = { callHandler : jest.fn() };
});

afterEach(() => {
	delete window.OverlayPluginApi;
	delete window.__OverlayCallback;
});

test("ACT OverlayPlugin still subscribes to combat, party, and log events", () => {
	const service = new PluginService();
	service.updateSubscriptions({}, { mode : "stats" });
	const [request, callback] = window.OverlayPluginApi.callHandler.mock.calls[0];
	expect(JSON.parse(request)).toMatchObject({
		call   : "subscribe",
		events : ["ChangePrimaryPlayer", "ChangeZone", "CombatData", "EnmityAggroList", "PartyChanged", "EnmityTargetData", "LogLine"],
	});
	expect(callback).toBe(MessageProcessor.processMessage);
	expect(service.getSubscriptions({}, { mode : "spells" })).toContain("LogLine");
});

test("an explicitly supplied activity source takes over the party and log inputs", () => {
	const service   = new PluginService();
	const subscribe = jest.fn();
	service.setActivitySource(subscribe);
	expect(subscribe).toHaveBeenCalledWith(MessageProcessor.processActivity);
	const events = service.getSubscriptions({}, { mode : "stats" });
	expect(events).toContain("CombatData");
	expect(events).not.toContain("LogLine");
	expect(events).not.toContain("PartyChanged");
});
