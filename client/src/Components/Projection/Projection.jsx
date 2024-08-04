import { For } from 'solid-js';
import { currentCountry, currentProjectionName, setCurrentProjectionName } from '../../global/projections';

function Projection(props) {
	let changeHandler = (e) => {
		setCurrentProjectionName(e.target.value);
	};

	return (
		<select value={currentProjectionName()} style={props.style} class="form-select" onchange={changeHandler}>
			<For each={currentCountry().projections}>{(projection) => <option value={projection.name}>{projection.name}</option>}</For>
		</select>
	);
}

export default Projection;
