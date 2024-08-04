import { currentCountry, currentProjectionName, projectReactive, setCurrentCountry, setCurrentProjectionName } from './projections';
import { runWithOwner } from 'solid-js';
import interpolate from 'color-interpolate';
import { compress, decompress } from 'lz-string';

import contoursIcon from '../assets/contoursIcon.png';
import L from 'leaflet';
import hotline from 'leaflet-hotline';
hotline(L);

import axios from 'axios';
import proj4data from './proj4data';

const analyzeButtonClick = (polygon, map, setErrorText, setErrorModalOpen) => {
	polygon.closePopup();
	map.fitBounds(polygon.getBounds());

	if (polygon.heightData) {
		setupMinPoint(polygon.heightData.minPoint, map, true);
		setupMaxPoint(polygon.heightData.maxPoint, map);

		map.fitBounds(polygon.getBounds());

		saveState(map);
		map.once('moveend', () => {
			saveState(map);
		});
	} else {
		polygon.getElement().classList.add('animate-flicker');

		axios({
			url: '/contourLines',
			method: 'POST',
			data: {
				latLngs: polygon._latlngs[0],
			},
		})
			.then((res) => {
				if (res.data.error) {
					setErrorText(res.data.message);
					setErrorModalOpen(true);
				} else {
					polygon.heightData = res.data;

					setupMinPoint(res.data.minPoint, map, true);
					setupMaxPoint(res.data.maxPoint, map);

					map.fitBounds(polygon.getBounds());

					saveState(map);
					map.once('moveend', () => {
						saveState(map);
					});
				}
			})
			.catch((err) => {
				setErrorText(err.message);
				setErrorModalOpen(true);
			})
			.finally(() => {
				polygon.getElement().classList.remove('animate-flicker');
			});
	}
};

const contourLinesButtonClick = (polygon, map, setErrorText, setErrorModalOpen) => {
	polygon.closePopup();
	map.fitBounds(polygon.getBounds());

	if (polygon.heightData) {
		setupContourLines(map, polygon, true);

		map.fitBounds(polygon.getBounds());

		saveState(map);
		map.once('moveend', () => {
			saveState(map);
		});
	} else {
		polygon.getElement().classList.add('animate-flicker');

		axios({
			url: '/contourLines',
			method: 'POST',
			data: {
				latLngs: polygon._latlngs[0],
			},
		})
			.then((res) => {
				if (res.data.error) {
					setErrorText(res.data.message);
					setErrorModalOpen(true);
				} else {
					polygon.heightData = res.data;

					setupContourLines(map, polygon, true);

					map.fitBounds(polygon.getBounds());

					saveState(map);
					map.once('moveend', () => {
						saveState(map);
					});
				}
			})
			.catch((err) => {
				setErrorText(err.message);
				setErrorModalOpen(true);
			})
			.finally(() => {
				polygon.getElement().classList.remove('animate-flicker');
			});
	}
};

const setupMarker = (marker, map) => {
	map.markers.push(marker);
	marker.on('remove', () => {
		let index = map.markers.indexOf(marker);
		if (index > -1) {
			map.markers.splice(index, 1);
		}

		saveState(map);
	});

	let projectedPosition = projectReactive(marker._latlng);

	runWithOwner(map.owner, () => {
		marker.popup = (
			<div>
				<b>X : </b>
				{currentCountry().country === 'Maroc' ? projectedPosition().x.toFixed(2) : projectedPosition().x.toFixed(6)}
				<br />
				<b>Y : </b>
				{currentCountry().country === 'Maroc' ? projectedPosition().y.toFixed(2) : projectedPosition().y.toFixed(6)}
				<br />
				<br />
				<b>— WGS 84 :</b>
				<br />
				<b>Lat : </b>
				{marker._latlng.lat.toFixed(6)}
				<br />
				<b>Long : </b>
				{marker._latlng.lng.toFixed(6)}
			</div>
		);
	});

	marker.bindPopup(marker.popup);
};

const setupPolyline = (polyline, map) => {
	map.polylines.push(polyline);
	polyline.on('remove', () => {
		let index = map.polylines.indexOf(polyline);
		if (index > -1) {
			map.polylines.splice(index, 1);
		}

		saveState(map);
	});

	let distance = 0,
		length = polyline._latlngs.length;
	for (let i = 1; i < length; i++) {
		distance += polyline._latlngs[i].distanceTo(polyline._latlngs[i - 1]);
	}

	runWithOwner(map.owner, () => {
		polyline.popup = (
			<div style={{ 'text-align': 'center' }}>
				<b>Distance :</b> {(Math.round(100 * distance) / 100).toLocaleString('en').split(',').join(' ')} <b>mètres</b>
			</div>
		);
	});

	polyline.bindPopup(polyline.popup);

	polyline.setStyle({
		color: '#00a8ff',
		weight: 5,
	});

	polyline.on({
		mouseover: function () {
			polyline.setStyle({ weight: 6 });
		},
		mouseout: function () {
			polyline.setStyle({ weight: 4 });
		},
	});
};

const updatePolygonsOrder = (map) => {
	map.polygons
		.sort(function (a, b) {
			return a.area > b.area ? 1 : -1;
		})
		.forEach(function (p) {
			p.bringToBack();
		});
};

const setupPolygon = (polygon, map, setErrorText, setErrorModalOpen) => {
	map.polygons.push(polygon);
	polygon.on('remove', () => {
		let index = map.polygons.indexOf(polygon);
		if (index > -1) {
			map.polygons.splice(index, 1);
		}

		saveState(map);
	});

	let latLngs = polygon._latlngs[0];

	let pointsCount = latLngs.length,
		area = 0.0,
		d2r = Math.PI / 180,
		p1,
		p2;

	if (pointsCount > 2) {
		for (let i = 0; i < pointsCount; i++) {
			p1 = latLngs[i];
			p2 = latLngs[(i + 1) % pointsCount];
			area += (p2.lng - p1.lng) * d2r * (2 + Math.sin(p1.lat * d2r) + Math.sin(p2.lat * d2r));
		}
		area = Math.abs((area * 6378137.0 * 6378137.0) / 2.0);
	}

	polygon.area = area;

	let ha = Math.floor(area / 1e4);
	let a = Math.floor((area - 1e4 * ha) / 100);
	let ca = Math.round(100 * (area - 1e4 * ha - 100 * a)) / 100;

	runWithOwner(map.owner, () => {
		polygon.popup = (
			<div>
				<div style={{ 'text-align': 'center' }}>
					<b>Superficie : </b>
					{(Math.round(100 * area) / 100).toLocaleString('en').split(',').join(' ')}
					<b> m²</b>
					<br />
					<span style={{ display: ha ? 'inline' : 'none' }}>
						{ha}
						<b> ha </b>
					</span>
					<span style={{ display: a ? 'inline' : 'none' }}>
						{a}
						<b> a </b>
					</span>
					<span style={{ display: ca ? 'inline' : 'none' }}>
						{ca}
						<b> ca</b>
					</span>
				</div>
				<div class="text-center mt-2">
					<button
						class="btn btn-sm btn-outline-primary"
						onClick={() => {
							analyzeButtonClick(polygon, map, setErrorText, setErrorModalOpen);
						}}
					>
						Analyser
					</button>
				</div>
				<div class="text-center mt-2">
					<button
						class="btn btn-sm btn-outline-primary"
						onClick={() => {
							contourLinesButtonClick(polygon, map, setErrorText, setErrorModalOpen);
						}}
					>
						<span style={{ display: 'inline-block', 'background-image': `url(${contoursIcon})`, 'background-size': 'contain', 'background-repeat': 'no-repeat', 'vertical-align': 'bottom', width: '23px', height: '23px' }} />
						&nbsp;MNT
					</button>
				</div>
			</div>
		);
	});

	polygon.bindPopup(polygon.popup);

	polygon.setStyle({
		color: '#91e400',
		weight: 3,
		fillOpacity: 0.15,
	});

	polygon.on({
		mouseover: function () {
			polygon.setStyle({ weight: 5 });
		},
		mouseout: function () {
			polygon.setStyle({ weight: 3 });
		},
	});
};

const setupMinPoint = (minPoint, map, open = false) => {
	let projectedMinPoint = projectReactive(minPoint.location);

	let minPointMarker = L.marker(minPoint.location);
	minPointMarker.getIcon().options.className = L.Marker.minPointClassName;
	minPointMarker.addTo(map);

	map.minPoints.push(minPoint);

	minPointMarker.on('remove', () => {
		let index = map.minPoints.indexOf(minPoint);
		if (index > -1) {
			map.minPoints.splice(index, 1);
		}

		saveState(map);
	});

	runWithOwner(map.owner, () => {
		minPointMarker.bindPopup(
			<div>
				<b>Point favorable ↓</b>
				<br />
				<b>X : </b>
				{currentCountry().country === 'Maroc' ? projectedMinPoint().x.toFixed(2) : projectedMinPoint().x.toFixed(6)}
				<br />
				<b>Y : </b>
				{currentCountry().country === 'Maroc' ? projectedMinPoint().y.toFixed(2) : projectedMinPoint().y.toFixed(6)}
				<br />
				<b>Z : </b>
				{minPoint.elevation.toFixed(2)}
				<br />
				<br />
				<b>— WGS 84 : </b>
				<br />
				<b>Lat : </b>
				{minPoint.location.lng.toFixed(6)}
				<br />
				<b>Long : </b>
				{minPoint.location.lat.toFixed(6)}
			</div>
		);
	});

	if (open) {
		minPointMarker.openPopup();
	}
};

const setupMaxPoint = (maxPoint, map) => {
	let projectedMaxPoint = projectReactive(maxPoint.location);

	let maxPointMarker = L.marker(maxPoint.location);
	maxPointMarker.getIcon().options.className = L.Marker.maxPointClassName;
	maxPointMarker.addTo(map);

	map.maxPoints.push(maxPoint);

	maxPointMarker.on('remove', () => {
		let index = map.maxPoints.indexOf(maxPoint);
		if (index > -1) {
			map.maxPoints.splice(index, 1);
		}

		saveState(map);
	});

	runWithOwner(map.owner, () => {
		maxPointMarker.bindPopup(
			<div>
				<b>Point défavorable ↑</b>
				<br />
				<b>X : </b>
				{currentCountry().country === 'Maroc' ? projectedMaxPoint().x.toFixed(2) : projectedMaxPoint().x.toFixed(6)}
				<br />
				<b>Y : </b>
				{currentCountry().country === 'Maroc' ? projectedMaxPoint().y.toFixed(2) : projectedMaxPoint().y.toFixed(6)}
				<br />
				<b>Z : </b>
				{maxPoint.elevation.toFixed(2)}
				<br />
				<br />
				<b>— WGS 84 : </b>
				<br />
				<b>Lat : </b>
				{maxPoint.location.lng.toFixed(6)}
				<br />
				<b>Long : </b>
				{maxPoint.location.lat.toFixed(6)}
			</div>
		);
	});
};

const setupContourLines = (map, polygon, openMinPointPopup = false) => {
	const data = polygon.heightData;

	let gradientPalette = ['#ff5900', '#7a5cff', '#308af9'];

	let colorMap = interpolate(gradientPalette);
	let contourPolylines = [];
	data.contourData.forEach((segment) => {
		let colorInterpolationFactor = (segment.elevation - data.minPoint.elevation) / (data.maxPoint.elevation - data.minPoint.elevation);
		let polyline = L.polyline(segment.latlngs, { color: colorMap(colorInterpolationFactor), weight: 4 });

		polyline.bindTooltip('Z = ' + segment.elevation.toFixed(2), { sticky: true });

		polyline.addTo(map);
		contourPolylines.push(polyline);
	});

	let minToMaxPolyline = new L.Hotline(
		[
			[data.minPoint.location.lat, data.minPoint.location.lng, 0],
			[data.maxPoint.location.lat, data.maxPoint.location.lng, 1],
		],
		{
			min: 0,
			max: 1,
			palette: {
				0: gradientPalette[0],
				0.5: gradientPalette[1],
				1: gradientPalette[2],
			},
			weight: 3,
			outlineWeight: 1,
			outlineColor: 'black',
		}
	);
	minToMaxPolyline.addTo(map);

	polygon.setStyle({
		color: '#ffffff',
	});

	polygon.on('remove', () => {
		minToMaxPolyline.removeFrom(map);
		contourPolylines.forEach((p) => {
			p.removeFrom(map);
		});

		saveState(map);
	});

	polygon.heightData.createdContours = true;
};

const saveState = (map) => {
	const countryIndex = proj4data.indexOf(currentCountry());
	const projectionName = currentProjectionName();

	const markers = [];
	map.markers.forEach((marker) => {
		markers.push(marker._latlng);
	});

	const polylines = [];
	map.polylines.forEach((polyline) => {
		polylines.push(polyline._latlngs);
	});

	const polygons = [];
	map.polygons.forEach((polygon) => {
		polygons.push({ latlngs: polygon._latlngs[0], heightData: polygon.heightData });
	});

	const bounds = [map.getBounds()._southWest, map.getBounds()._northEast];

	localStorage.setItem('cached', compress(JSON.stringify({ countryIndex, projectionName, bounds, markers, minPoints: map.minPoints, maxPoints: map.maxPoints, polylines, polygons })));
};

const loadState = (map, setErrorText, setErrorModalOpen) => {
	const compressedStateData = localStorage.getItem('cached');
	if (!compressedStateData) return;

	const { countryIndex, projectionName, bounds, markers, minPoints, maxPoints, polylines, polygons } = JSON.parse(decompress(compressedStateData));

	setCurrentCountry(proj4data[countryIndex]);
	setCurrentProjectionName(projectionName);

	map.fitBounds(bounds);

	markers.forEach((latlng) => {
		const marker = L.marker(latlng);
		marker.addTo(map);
		setupMarker(marker, map);
	});

	minPoints.forEach((minPoint) => {
		setupMinPoint(minPoint, map);
	});

	maxPoints.forEach((maxPoint) => {
		setupMaxPoint(maxPoint, map);
	});

	polylines.forEach((latlngs) => {
		const polyline = L.polyline(latlngs);
		polyline.addTo(map);
		setupPolyline(polyline, map);
	});

	polygons.forEach(({ latlngs, heightData }) => {
		const polygon = L.polygon(latlngs);
		polygon.addTo(map);
		setupPolygon(polygon, map, setErrorText, setErrorModalOpen);

		if (heightData) {
			polygon.heightData = heightData;
			if (heightData.createdContours) {
				setupContourLines(map, polygon, false);
			}
		}
	});

	updatePolygonsOrder(map);
};

export { setupMarker, setupPolyline, setupPolygon, updatePolygonsOrder, saveState, loadState };
