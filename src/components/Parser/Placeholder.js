import React from "react";
import jquery from "jquery";

class Placeholder extends React.Component {
	togglePlaceholders() {
		const $container = jquery(document).find("#container");
		const active     = $container.hasClass("hidden");

		jquery(document).find(".placeholder").each(function() {
			jquery(this).toggleClass("hidden", active);
		});

		$container.toggleClass("hidden", !active);
	}

	render() {
		const image_src = `img/icons/placeholder-${this.props.theme}-theme.png`;

		return (
			<div className={"placeholder " + this.props.type + " hidden"} onClick={this.togglePlaceholders.bind(this)}>
				<div className='inner'>
					<img src={image_src} alt='Minimized button'></img>
				</div>
			</div>
		);
	}
}

export default Placeholder;
