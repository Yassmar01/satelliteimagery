import { Show, createEffect } from 'solid-js';
import style from './PointScatter.module.css';
import { saveState, setupMarker } from '../../global/entities';

const PointScatter = (props) => {
	let slider, scatterBounds, polygonVertices;

	let placeholderMarkers = [];

	createEffect(() => {
		if (props.polygon()) {
			scatterBounds = props.polygon().getBounds();

			polygonVertices = [];
			const latLngs = props.polygon()._latlngs[0];

			latLngs.forEach((v) => {
				polygonVertices.push([v.lat, v.lng]);
			});
			polygonVertices.push(polygonVertices[0]);

			props.map.fitBounds(scatterBounds);
			slider.value = 20;

			update();
		}
	});

	const cancelHandler = () => {
		placeholderMarkers.forEach((marker) => {
			marker.removeFrom(props.map);
		});

		placeholderMarkers = [];

		props.setPolygon(null);
	};

	const applyHandler = () => {
		placeholderMarkers.forEach((marker) => {
			setupMarker(marker, props.map);
		});

		placeholderMarkers = [];

		props.setPolygon(null);

		saveState(props.map);
	};

	const changeHandler = () => {
		update();
	};

	const update = () => {
		const numberOfDivs = slider.value;

		placeholderMarkers.forEach((marker) => {
			marker.removeFrom(props.map);
		});

		placeholderMarkers = [];

		let width = scatterBounds._northEast.lng - scatterBounds._southWest.lng;
		let height = scatterBounds._northEast.lat - scatterBounds._southWest.lat;
		let step = 0;

		if (width > height) {
			step = width / numberOfDivs;
		} else {
			step = height / numberOfDivs;
		}

		for (let i = 0; i < numberOfDivs; i++) {
			for (let j = 0; j < numberOfDivs; j++) {
				let lat = scatterBounds._southWest.lat + i * step;
				let lng = scatterBounds._southWest.lng + j * step;

				if (isPointInsidePolygon([lat, lng], polygonVertices)) {
					const marker = L.marker({ lat, lng });
					marker.addTo(props.map);
					placeholderMarkers.push(marker);
				}
			}
		}
	};

	return (
		<Show when={props.polygon()}>
			<div class={style.container}>
				<div class={style.window}>
					<div class="row">
						<div class="col">
							<b>Min</b>
						</div>
						<div class="col" style="text-align: right;">
							<b>Max</b>
						</div>
					</div>
					<div class="row px-4">
						<input ref={slider} class="form-range" min={10} max={30} type="range" onchange={changeHandler} />
					</div>
					<div class="row mt-2">
						<div class="col">
							<button class="btn btn-sm btn-danger" onclick={cancelHandler}>
								Annuler
							</button>
						</div>
						<div class="col" style="text-align: right;">
							<button class="btn btn-sm btn-primary" onclick={applyHandler}>
								Appliquer
							</button>
						</div>
					</div>
				</div>
			</div>
		</Show>
	);
};

function isPointInsidePolygon(point, vs) {
	// ray-casting algorithm based on
	// http://www.ecse.rpi.edu/Homepages/wrf/Research/Short_Notes/pnpoly.html

	var x = point[0],
		y = point[1];

	var inside = false;
	for (var i = 0, j = vs.length - 1; i < vs.length; j = i++) {
		var xi = vs[i][0],
			yi = vs[i][1];
		var xj = vs[j][0],
			yj = vs[j][1];

		var intersect = yi > y != yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
		if (intersect) inside = !inside;
	}

	return inside;
}

export default PointScatter;
