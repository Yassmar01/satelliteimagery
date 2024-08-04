import DxfParser from 'dxf-parser';
import { setupMarker, setupPolygon, setupPolyline, updatePolygonsOrder } from '../../global/entities';
import { unproject } from '../../global/projections';

function extendBoundingBox(boundingBox, latlng) {
	if ('lat' in latlng) latlng = [latlng.lat, latlng.lng];

	if (!boundingBox.minLat) {
		boundingBox.minLat = latlng[0];
		boundingBox.minLng = latlng[1];
		boundingBox.maxLat = latlng[0];
		boundingBox.maxLng = latlng[1];
	} else {
		if (boundingBox.minLat > latlng[0]) boundingBox.minLat = latlng[0];
		else if (boundingBox.maxLat < latlng[0]) boundingBox.maxLat = latlng[0];
		if (boundingBox.minLng > latlng[1]) boundingBox.minLng = latlng[1];
		else if (boundingBox.maxLng < latlng[1]) boundingBox.maxLng = latlng[1];
	}
}

function parseDXF(text) {
	var parser = new DxfParser();
	var points = [];
	var polylines = [];
	var polygons = [];

	var dxf = parser.parseSync(text);

	var entities = dxf.entities || [];

	entities.forEach(function (entity) {
		if (entity.type == 'POINT' || entity.type == 'INSERT') {
			if (entity.position && entity.position.x && entity.position.y) {
				points.push({
					position: entity.position,
				});
			}
		} else if (entity.type == 'LINE') {
			polylines.push({
				vertices: entity.vertices,
			});
		} else if (entity.type == 'LWPOLYLINE' || entity.type == 'POLYLINE') {
			if (entity.shape)
				polygons.push({
					vertices: entity.vertices,
				});
			else {
				polylines.push({
					vertices: entity.vertices,
				});
			}
		}
	});

	return {
		points: points,
		polylines: polylines,
		polygons: polygons,
	};
}

function drawDxf(text, map) {
	const { points, polylines, polygons } = parseDXF(text);

	var boundingBox = {
		minLat: null,
		minLng: null,
		maxLat: null,
		maxLng: null,
	};

	points.forEach(({ position }) => {
		const { lat, lng } = unproject({ x: position.x, y: position.y });

		extendBoundingBox(boundingBox, [lat, lng]);

		const marker = L.marker([lat, lng]);
		marker.addTo(map);
		setupMarker(marker, map);
	});

	polylines.forEach(({ vertices }) => {
		const latLngs = [];
		vertices.forEach(({ x, y }) => {
			const { lat, lng } = unproject({ x, y });
			latLngs.push([lat, lng]);
			extendBoundingBox(boundingBox, [lat, lng]);
		});

		const polyline = L.polyline([latLngs]);
		polyline.addTo(map);
		setupPolyline(polyline, map);
	});

	polygons.forEach(({ vertices }) => {
		const latLngs = [];
		vertices.forEach(({ x, y }) => {
			const { lat, lng } = unproject({ x, y });
			latLngs.push([lat, lng]);
			extendBoundingBox(boundingBox, [lat, lng]);
		});

		const polygon = L.polygon(latLngs);
		polygon.addTo(map);
		setupPolygon(polygon, map);
	});

	updatePolygonsOrder(map);

	return [
		[boundingBox.minLat, boundingBox.minLng],
		[boundingBox.maxLat, boundingBox.maxLng],
	];
}

export default drawDxf;
