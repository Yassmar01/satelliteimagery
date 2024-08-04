import express from 'express';
import bodyParser from 'body-parser';
import elevation from './utils/elevation.js';
import Conrec from './utils/conrec.js';
import dotenv from 'dotenv';

dotenv.config();

import { Coordinate, LineString, MultiLineString, GeometryFactory } from 'jsts/org/locationtech/jts/geom.js';
import { distance } from 'jsts/org/locationtech/jts/operation.js';
import { OverlayOp } from 'jsts/org/locationtech/jts/operation/overlay.js';
import nocache from 'nocache';

const { DistanceOp } = distance;
const geometryFactory = new GeometryFactory();

const app = express();

app.use(bodyParser.json());

app.use(nocache());

app.use(express.static('./client/dist'));

app.post('/elevations', (req, res) => {
	elevation(req.body.latLngs)
		.then((latLngZs) => {
			res.send(latLngZs);
		})
		.catch((err) => {
			res.send({ error: true, message: err.message });
		});
});

app.post('/contourLines', (req, res) => {
	const nOfDivs = 50;

	let vertices = req.body.latLngs;

	let coordinates = vertices.map((vertex) => new Coordinate(vertex.lng, vertex.lat));
	coordinates.push(coordinates[0]);

	let shell = geometryFactory.createLinearRing(coordinates);
	let polygon = geometryFactory.createPolygon(shell);

	let minLat, minLng, maxLat, maxLng;

	vertices.forEach((v) => {
		if (!minLat || v.lat < minLat) {
			minLat = v.lat;
		}

		if (!minLng || v.lng < minLng) {
			minLng = v.lng;
		}

		if (!maxLat || v.lat > maxLat) {
			maxLat = v.lat;
		}

		if (!maxLng || v.lng > maxLng) {
			maxLng = v.lng;
		}
	});

	var heightIsLonger = true;
	var width = Math.abs(maxLng - minLng);
	var height = Math.abs(maxLat - minLat);
	var heightIsLonger = height > width;

	var hStep, wStep;
	var nOfDivsH, nOfDivsV;
	if (heightIsLonger) {
		hStep = height / nOfDivs;
		wStep = width / Math.ceil(width / hStep);
		nOfDivsH = Math.round(width / wStep);
		nOfDivsV = nOfDivs;
	} else {
		wStep = width / nOfDivs;
		hStep = height / Math.ceil(height / wStep);
		nOfDivsH = nOfDivs;
		nOfDivsV = Math.round(height / hStep);
	}

	var lngs = [],
		lats = [];
	for (let i = 0; i <= nOfDivsH; i++) {
		lngs.push(minLng + i * wStep);
	}
	for (let j = 0; j <= nOfDivsV; j++) {
		lats.push(minLat + j * hStep);
	}

	var elevationsToRequest = [];
	lngs.forEach((lng) => {
		lats.forEach((lat) => {
			elevationsToRequest.push({ lat, lng });
		});
	});

	elevation(elevationsToRequest)
		.then((elevations) => {
			// find min & max points
			let minPoint, maxPoint;
			elevations.forEach((p) => {
				if (!minPoint || minPoint.elevation > p.elevation) {
					let jstsPoint = geometryFactory.createPoint(new Coordinate(p.location.lng, p.location.lat));
					if (DistanceOp.distance(jstsPoint, polygon) === 0) {
						minPoint = p;
					}
				}

				if (!maxPoint || maxPoint.elevation < p.elevation) {
					let jstsPoint = geometryFactory.createPoint(new Coordinate(p.location.lng, p.location.lat));
					if (DistanceOp.distance(jstsPoint, polygon) === 0) {
						maxPoint = p;
					}
				}
			});

			// create contour lines

			var conrecMatrix = [];
			for (let i = 0; i <= nOfDivsH; i++) {
				var col = [];
				for (let j = 0; j <= nOfDivsV; j++) {
					col.push(elevations[j + i * (nOfDivsV + 1)].elevation);
				}
				conrecMatrix.push(col);
			}

			var elevationRange = maxPoint.elevation - minPoint.elevation;
			var possibleSteps = [1000, 750, 500, 400, 300, 250, 200, 150, 100, 75, 50, 40, 30, 25, 20, 15, 10, 5, 4, 3, 2.5, 2, 1.5, 1, 0.75, 0.5, 0.4, 0.3, 0.25, 0.2, 0.15, 0.1];
			var step;

			for (let i = 0; i < possibleSteps.length; i++) {
				step = possibleSteps[i];
				var levelCount = Math.floor(elevationRange / step) + 1;
				if (levelCount >= 10) break;
			}

			var levels = [];
			var minLevel = Math.floor(minPoint.elevation / step) * step;

			for (let level = minLevel; level < maxPoint.elevation; level += step) {
				levels.push(level);
			}

			var c = new Conrec();
			c.contour(conrecMatrix, 0, lngs.length - 1, 0, lats.length - 1, lngs, lats, levels.length, levels);
			var contourList = c.contourList();

			var contourData = [];
			contourList.forEach((contour) => {
				let polylineCoordinates = contour.map((p) => new Coordinate(p.x, p.y));
				let jstsPolyline = geometryFactory.createLineString(polylineCoordinates);

				let intersection = OverlayOp.intersection(polygon, jstsPolyline);

				if (intersection instanceof LineString) {
					const polyline = {
						elevation: contour.level,
						latlngs: [],
					};
					intersection.getCoordinates().forEach((v) => {
						polyline.latlngs.push([v.y, v.x]);
					});
					contourData.push(polyline);
				} else if (intersection instanceof MultiLineString) {
					for (let i = 0; i < intersection.getNumGeometries(); i++) {
						const ls = intersection.getGeometryN(i);
						const polyline = {
							elevation: contour.level,
							latlngs: [],
						};
						ls.getCoordinates().forEach((v) => {
							polyline.latlngs.push([v.y, v.x]);
						});
						contourData.push(polyline);
					}
				}
			});
			res.send({ minPoint, maxPoint, contourData });
		})
		.catch((err) => {
			res.status(200).send({ error: true, message: err.message });
		});
});

const port = process.env.PORT || 5000;
app.listen(port, () => {
	console.log(`app is listening on port ${port}`);
});
