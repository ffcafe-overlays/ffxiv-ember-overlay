import React from "react";
import { Container } from "semantic-ui-react";

import LocalizationService from "../../services/LocalizationService";
import VersionService from "../../services/VersionService";

import SocialLink from "./About/SocialLink";

const reactStringReplace = require("react-string-replace");

class About extends React.Component {
	render() {
		const github_url  = process.env.REACT_APP_GITHUB_URL;
		const author_url  = process.env.REACT_APP_AUTHOR_URL;
		const author_link = <a href={author_url} target='_blank' rel='noopener noreferrer'>GoldenChrysus</a>;

		return (
			<React.Fragment>
				<Container fluid className='section-container'>
					<h2>{LocalizationService.getSettingsSubsectionText("about", 0)}</h2>
					<p>{reactStringReplace(LocalizationService.getMisc("developer_credit"), "{{developer}}", () => author_link)}</p>

					<h3>GitHub</h3>
					<p>
						{LocalizationService.getMisc("github_cta")}<br/>
						<a href={github_url} target='_blank' rel='noopener noreferrer'>{github_url}</a>
					</p>

					<h3>Credits</h3>
					<p id='credits'>
						<ul>
							<li><strong className='featured'>Pimpy Shortstocking</strong> - Featured donor</li>
							<li><strong className='featured'>FortiusTTV</strong> - <SocialLink name='fortiusttv' type='twitch'/> - Featured donor</li>
							<li><strong className='featured'>loski3</strong> - Featured donor</li>
							<li><strong className='featured'>Vale Alania</strong> - Featured donor</li>
						</ul>

						<ul>
							<li><strong>Bona</strong> - Portuguese translation</li>
							<li><strong>ShadyWhite</strong> - Chinese translation</li>
							<li><strong>Gusma</strong> - Portuguese translation</li>
							<li><strong>The_X</strong> - Portuguese translation</li>
							<li><strong>okuRaku</strong> <SocialLink name='okurakuu' type='twitter'/><SocialLink name='okuraku' type='twitch'/> - Japanese translation</li>
							<li><strong>Astriel</strong> - German translation</li>
							<li><strong>Claud</strong> - Spanish translation</li>
							<li><strong>Okâme</strong> - French translation</li>
							<li><strong>Tsunari96</strong> - Tsunari96#8491 (Discord) - Korean translation</li>
							<li><strong>justscribe</strong> <SocialLink name='justscribe' type='twitch'/><SocialLink type='globe' url='https://ffxiv.gaming4eternity.online/'/> - Ukrainian translation</li>
							<li><strong>Gisar</strong> - Russian translation</li>
						</ul>

						<ul>
							<li><strong>Amneamnius</strong> - Donor</li>
							<li><strong>Vulasuw</strong> - Donor</li>
							<li><strong>Jessica</strong> - Donor</li>
							<li><strong>mehdont</strong> - Donor</li>
							<li><strong>Tomo</strong> - Donor</li>
						</ul>
					</p>
				</Container>
			</React.Fragment>
		);
	}
}

export default About;
