/* eslint-env jest */
import React from "react";
import ReactDOM from "react-dom";
import { act } from "react-dom/test-utils";
import OverlayInfo from "./OverlayInfo";
import store from "../../../redux/store/index";

jest.mock("../../../redux/store/index", () => ({ getState : jest.fn() }));

let container;

beforeEach(() => {
	container = document.createElement("div");
	document.body.appendChild(container);
});

afterEach(() => {
	ReactDOM.unmountComponentAtNode(container);
	container.remove();
});

test.each([
	["cn", "尚未监控任何技能或效果，请在「设置 → 冷却监控」中添加。", "使用监控中的技能或效果后，本提示会自动隐藏。"],
	["en", "You are not tracking any spells or effects. Please add some at Settings > Spell Timers.", "This section will disappear when a tracked spell/effect is used."],
	["jp", "You are not tracking any spells or effects. Please add some at Settings > Spell Timers.", "This section will disappear when a tracked spell/effect is used."],
])("empty timers use the %s locale with English fallback", (language, configure, disappear) => {
	store.getState.mockReturnValue({ settings : { interface : { language } } });
	act(() => {
		ReactDOM.render(<OverlayInfo mode='spells' settings={{ spells : [], effects : [] }}/>, container);
	});
	expect(Array.from(container.querySelectorAll("p"), element => element.textContent)).toEqual([configure, disappear]);
});

test.each([
	[["skill"], []],
	[[], ["effect"]],
	[["skill"], ["effect"]],
])("configured timers retain only the disappearance hint", (spells, effects) => {
	store.getState.mockReturnValue({ settings : { interface : { language : "cn" } } });
	act(() => {
		ReactDOM.render(<OverlayInfo mode='spells' settings={{ spells, effects }}/>, container);
	});
	expect(Array.from(container.querySelectorAll("p"), element => element.textContent)).toEqual(["使用监控中的技能或效果后，本提示会自动隐藏。"]);
});
