import React, { useState } from "react";
import RCSlider from "rc-slider";
import "rc-slider/assets/index.css";

export default function Slider(props) {
	const { label, minimum, maximum, key_path, onChange } = props;
	const [value, setValue]                               = useState(props.value);

	let reverse = false;
	let range   = false;

	switch (props.range) {
		case "max":
			reverse = true;
			break;
		case true:
			range = true;
			break;
		default:
			break;
	}

	return (
		<>
			<label>{label}: <span className='value'>{value}</span></label>
			<RCSlider
				range={range}
				reverse={reverse}
				min={minimum}
				max={maximum}
				value={value}
				onChange={value => {
					setValue(value);
					onChange(null, { key_path, value });
				}}
				styles={{
					rail   : { height : 10 },
					track  : { height : 10 },
					handle : {
						height     : 16,
						width      : 16,
						marginLeft : -3,
						marginTop  : -3,
					},
				}}
			/>
		</>
	);
}
