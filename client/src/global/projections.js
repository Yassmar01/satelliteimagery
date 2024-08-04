import proj4 from 'proj4';
import { createSignal } from 'solid-js';
import proj4data from './proj4data';

proj4data.forEach((projectionList) => {
	projectionList.projections.forEach((projection) => {
		proj4.defs(projection.name, projection.def);
	});
});

const defaultCountry = proj4data[0];
const defaultProjectionName = proj4data[0].projections[0].name;

const [currentCountry, setCurrentCountry] = createSignal(defaultCountry);
const [currentProjectionName, setCurrentProjectionName] = createSignal(defaultProjectionName);

const projectReactive = ({ lat, lng }) => {
	return () => {
		const [x, y] = proj4('WGS84', currentProjectionName()).forward([lng, lat]);
		return { x, y };
	};
};

const project = ({ lat, lng }) => {
	const [x, y] = proj4('WGS84', currentProjectionName()).forward([lng, lat]);
	return { x, y };
};

const unproject = ({ x, y }) => {
	const [lng, lat] = proj4('WGS84', currentProjectionName()).inverse([x, y]);
	return { lat, lng };
};

export { currentProjectionName, setCurrentProjectionName, currentCountry, setCurrentCountry, project, projectReactive, unproject };
