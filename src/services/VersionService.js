import store from "../redux/store/index";
import { updateSetting, updateState } from "../redux/actions/index";
import compareVersions from "compare-versions";

class VersionService {
	getSystemVersion() {
		return process.env.REACT_APP_VERSION;
	}

	getLastUserVersion() {
		const intrinsic_settings = store.getState().settings.intrinsic;

		return intrinsic_settings.last_version || "0.0.0";
	}

	getCurrentUserVersion() {
		const intrinsic_settings = store.getState().settings.intrinsic;

		return intrinsic_settings.current_version || "0.0.0";
	}

	determineIfNewer() {
		const system_version  = this.getSystemVersion();
		const current_version = this.getCurrentUserVersion();
		const settings_data   = store.getState().settings_data;

		if (!compareVersions.compare(system_version, current_version, ">")) {
			return false;
		}

		settings_data.setSetting("intrinsic.current_version", system_version, true);

		const last_data = {
			key   : "intrinsic.last_version",
			value : current_version,
		};

		store.dispatch(updateSetting(last_data));

		const new_data = {
			key   : "internal.new_version",
			value : true,
		};

		store.dispatch(updateState(new_data));
		return true;
	}
}

export default new VersionService();
