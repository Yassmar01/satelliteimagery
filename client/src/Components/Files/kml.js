import toGeoJSON from '@mapbox/togeojson';
import { setupMarker, setupPolygon, setupPolyline, updatePolygonsOrder } from '../../global/entities';

let map = null;

function createMarker(latLng) {
	const marker = L.marker(latLng);
	setupMarker(marker, map);
	marker.addTo(map);
	return marker;
}

function createPolyline(latLngs) {
	const polyline = L.polyline(latLngs);
	setupPolyline(polyline, map);
	polyline.addTo(map);
	return polyline;
}

function createPolygon(latLngs) {
	const polygon = L.polygon(latLngs);
	setupPolygon(polygon, map);
	polygon.addTo(map);
	return polygon;
}

function getEntityLatLngs(entity, nested = false, doublyNested = false) {
	if (nested) {
		var latLngs = [];
		entity.forEach(function (subEntity) {
			latLngs.push(getEntityLatLngs(subEntity, doublyNested));
		});
		return latLngs;
	} else {
		return [entity[1], entity[0]];
	}
}

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

function drawFeature(feature, boundingBox) {
	if (feature.geometry.type == 'Point') {
		var latLng = getEntityLatLngs(feature.geometry.coordinates);
		createMarker(latLng);
		extendBoundingBox(boundingBox, latLng);
	} else if (feature.geometry.type == 'LineString') {
		var pl = createPolyline(getEntityLatLngs(feature.geometry.coordinates, true));
		extendBoundingBox(boundingBox, pl.getBounds().getSouthWest());
		extendBoundingBox(boundingBox, pl.getBounds().getNorthEast());
	} else if (feature.geometry.type == 'Polygon') {
		var pg = createPolygon(getEntityLatLngs(feature.geometry.coordinates, true, true));
		extendBoundingBox(boundingBox, pg.getBounds().getSouthWest());
		extendBoundingBox(boundingBox, pg.getBounds().getNorthEast());
	} else if (feature.geometry.type == 'MultiPoint') {
		feature.geometry.coordinates.forEach(function (point) {
			var latLng = getEntityLatLngs(point);
			createMarker(latLng, false, feature.properties);
			extendBoundingBox(boundingBox, latLng);
		});
	} else if (feature.geometry.type == 'MultiLineString') {
		feature.geometry.coordinates.forEach(function (lineString) {
			var pl = createPolyline(getEntityLatLngs(lineString, true));
			extendBoundingBox(boundingBox, pl.getBounds().getSouthWest());
			extendBoundingBox(boundingBox, pl.getBounds().getNorthEast());
		});
	} else if (feature.geometry.type == 'MultiPolygon') {
		feature.geometry.coordinates.forEach(function (polygon) {
			var pg = createPolygon(getEntityLatLngs(polygon, true, true));
			extendBoundingBox(boundingBox, pg.getBounds().getSouthWest());
			extendBoundingBox(boundingBox, pg.getBounds().getNorthEast());
		});
	} else if (feature.geometry.type == 'GeometryCollection') {
		feature.geometries.forEach(function (geometry) {
			drawFeature(
				{
					type: 'Feature',
					properties: feature.properties,
					geometry: geometry,
				},
				boundingBox
			);
		});
	} else if (feature.type == 'FeatureCollection') {
		drawFeatureCollection(feature, boundingBox);
	}
}

function drawFeatureCollection(collection, boundingBox) {
	collection.features.forEach(function (feature) {
		if (feature.type == 'FeatureCollection') {
			drawFeatureCollection(feature, boundingBox);
		} else {
			drawFeature(feature, boundingBox);
		}
	});
}

function drawKml(kml, workingMap) {
	map = workingMap;

	const geoJSON = toGeoJSON.kml(kml);

	var boundingBox = {
		minLat: null,
		minLng: null,
		maxLat: null,
		maxLng: null,
	};

	if (Array.isArray(geoJSON)) {
		geoJSON.forEach(function (layer) {
			drawFeatureCollection(layer, boundingBox);
		});
	} else {
		drawFeatureCollection(geoJSON, boundingBox);
	}

	updatePolygonsOrder(map);

	return [
		[boundingBox.minLat, boundingBox.minLng],
		[boundingBox.maxLat, boundingBox.maxLng],
	];
}

export default drawKml;
