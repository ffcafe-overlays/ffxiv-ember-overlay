/* eslint-env jest, node */
import fs from "fs";
import SocketService from "./SocketService";
import PluginService from "../PluginService";
import OverlayPluginService from "./OverlayPluginService";
import OverlayProcService from "./OverlayProcService";

jest.mock("../../processors/MessageProcessor", () => ({}));
jest.mock("../../redux/store", () => ({ getState : () => ({ internal : {} }) }));
jest.mock("../../redux/actions", () => ({}));
jest.mock("../UsageService", () => ({}));

const original_location = window.location;
const original_socket   = window.WebSocket;
const original_env      = { ...process.env };
const config            = JSON.parse(fs.readFileSync(`${__dirname}/../../../.env-cmdrc`, "utf8"));

function navigate(url) {
	delete window.location;
	window.location = Object.assign(new URL(url), { replace : jest.fn() });
}

beforeEach(() => {
	Object.assign(process.env, config.default);
	delete window.OverlayPluginApi;
	window.WebSocket = jest.fn();
	navigate("https://overlays.ffcafe.cn/ember/");
});

afterEach(() => {
	delete window.location;
	window.location  = original_location;
	window.WebSocket = original_socket;
	process.env      = { ...original_env };
	delete window.OverlayPluginApi;
});

test.each(["OVERLAY_WS", "HOST_PORT"])("uses the host API without navigating for %s", parameter => {
	navigate(`https://overlays.ffcafe.cn/ember/?${parameter}=ws://mojito-overlay.invalid`);
	window.OverlayPluginApi = { callHandler : jest.fn() };

	const service = new PluginService();
	service.subscribe(["CombatData"]);

	expect(service.is_websocket).toBe(false);
	expect(service.plugin_service).toBeInstanceOf(OverlayPluginService);
	expect(window.OverlayPluginApi.callHandler).toHaveBeenCalled();
	expect(window.location.replace).not.toHaveBeenCalled();
	expect(window.WebSocket).not.toHaveBeenCalled();
});

test.each(["OVERLAY_WS", "HOST_PORT"])("redirects %s once while retaining the query and hash", parameter => {
	const query = `?${parameter}=ws%3A%2F%2F127.0.0.1%3A10501%2F&label=a%2Bb&label=c`;
	navigate(`https://overlays.ffcafe.cn/ember/${query}#/settings`);

	expect(new SocketService().uri).toBe(false);
	expect(window.location.replace).toHaveBeenCalledTimes(1);
	expect(window.location.replace).toHaveBeenCalledWith(`http://overlays.ffcafe.cn/ember/${query}#/settings`);

	navigate(window.location.replace.mock.calls[0][0]);

	expect(new SocketService().uri).toBe("ws://127.0.0.1:10501/ws");
	expect(window.location.replace).not.toHaveBeenCalled();
});

test("uses secure sockets without redirecting", () => {
	navigate("https://overlays.ffcafe.cn/ember/?OVERLAY_WS=wss://example.com/");

	const service = new PluginService();

	expect(service.plugin_service).toBeInstanceOf(SocketService);
	expect(service.socket_service.uri).toBe("wss://example.com/ws");
	expect(window.location.replace).not.toHaveBeenCalled();
});

test("keeps the no-parameter OverlayProc fallback", () => {
	const service = new PluginService();

	expect(service.plugin_service).toBeInstanceOf(OverlayProcService);
	expect(service.socket_service.uri).toBe(false);
	expect(window.location.replace).not.toHaveBeenCalled();
});

test("keeps fake socket handling", () => {
	navigate("https://overlays.ffcafe.cn/ember/?HOST_PORT=ws://example.com/fake");

	expect(new SocketService().uri).toBe("ws://example.com/fake/MiniParse");
	expect(window.location.replace).not.toHaveBeenCalled();
});

test("keeps HOST_PORT precedence and existing socket paths", () => {
	navigate("http://overlays.ffcafe.cn/ember/?HOST_PORT=ws://127.0.0.1:10501/ws&OVERLAY_WS=ws://other.invalid");

	expect(new SocketService().uri).toBe("ws://127.0.0.1:10501/ws");
	expect(window.location.replace).not.toHaveBeenCalled();
});
