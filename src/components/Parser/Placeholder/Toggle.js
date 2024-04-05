import React from "react";
import jquery from "jquery";

class Toggle extends React.Component {
	togglePlaceholders() {
		const $container = jquery(document).find("#container");
		const self       = this;

		jquery(document).find(".placeholder").each(function() {
			const hidden = (!jquery(this).hasClass(self.props.type));

			jquery(this).toggleClass("hidden", hidden);
		});

		$container.toggleClass("hidden", true);
	}

	render() {
		return (
			<div className={"toggle " + this.props.type} onClick={this.togglePlaceholders.bind(this)}></div>
		);
	}
}

export default Toggle;
