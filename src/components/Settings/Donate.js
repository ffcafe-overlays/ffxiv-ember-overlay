import React from "react";
import { Container } from "semantic-ui-react";
import SocialLink from "./About/SocialLink";


class Donate extends React.Component {
	render() {
		return (
			<React.Fragment>
				<Container fluid className='section-container'>
					<h2>Donate</h2>
					<p>
						如果你喜欢该悬浮窗，请前往原作者的 GitHub 页面获取捐助地址：https://github.com/GoldenChrysus/ffxiv-ember-overlay#funding
					</p>

					<h2>Featured Donors</h2>
					<p>Pimpy Shortstocking, FortiusTTV <SocialLink name='fortiusttv' type='twitch'/>, loski3, Vale Alania</p>

					<h2>Donors</h2>
					<p>Amneamnius, Vulasuw, Jessica, mehdont, tomo</p>
				</Container>
			</React.Fragment>
		);
	}
}

export default Donate;
