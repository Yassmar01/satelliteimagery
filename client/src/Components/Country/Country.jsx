import { For } from 'solid-js';
import proj4data from '../../global/proj4data';
import { currentCountry, setCurrentCountry, setCurrentProjectionName } from '../../global/projections';

function Country(props) {
	let changeHandler = (e) => {
		setCurrentCountry(proj4data[e.target.value]);
		setCurrentProjectionName(proj4data[e.target.value].projections[0].name);
	};

	return (
		<select value={proj4data.indexOf(currentCountry())} style={props.style} class="form-select" onchange={changeHandler}>
			<For each={proj4data}>{(country, index) => <option value={index()}>{country.country}</option>}</For>
		</select>
	);
}

export default Country;
