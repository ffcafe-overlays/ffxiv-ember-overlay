import React from "react";

import DonationService from "../../../services/DonationService";

class OverlayInfo extends React.Component {
	UNSAFE_componentWillMount() {
		// Hibiya OverlayPlugin: 45.0.2454.85
		// ACTWS: 53.0.2785.148
		// ngld OverlayPlugin: 78
		const browser_data  = navigator.userAgent.match(/Chrome\/[\d.]+/g);
		let browser_version = "hibiya";

		if (browser_data) {
			const chrome_version = Number(browser_data[0].split("/")[1].split(".")[0]);

			if (chrome_version >= 65) {
				browser_version = "ngld";
			} else if (chrome_version >= 53) {
				browser_version = "actws";
			}
		} else {
			// Probably in a non-Chrome desktop browser, so we'll call it ngld for consistency
			browser_version = "ngld";
		}

		this.setState({
			chrome : browser_version,
		});
	}

	render() {
		return (
			<div id='overlay-info' ref={el => (this.instance = el)}>
				<h3>Ember Overlay</h3>
				{this.getInfoText()}
			</div>
		);
	}

	getInfoText() {
		switch (this.props.mode) {
			case "spells":
				const configure_text = (!this.props.settings.spells.length && !this.props.settings.effects.length)
					? <p>You are not tracking any spells or effects. Please add some at Settings &gt; Spell Timers.</p>
					: "";
				return (
					<React.Fragment>
						{configure_text}
						<p>This section will disappear when a tracked spell/effect is used.</p>
					</React.Fragment>
				);

			default:
				return (
					<React.Fragment>
						<p>
							开始战斗后本提示信息会自动隐藏。
						</p>
					</React.Fragment>
				);
		}
	}
}

export default OverlayInfo;
