import jquery from "jquery";

class ThemeService {
	mode_classes = [
		"stats",
		"spells",
	];

	setTheme(theme) {
		jquery("body").attr("theme", theme);
	}

	toggleHorizontal(active) {
		jquery("body").toggleClass("horizontal", active);
	}

	toggleMinimal(active) {
		jquery("body").toggleClass("minimal", active);
	}

	setMode(new_mode) {
		for (const mode of this.mode_classes) {
			jquery("body").toggleClass(`mode-${mode}`, (mode === new_mode));
		}
	}
}

export default new ThemeService();
