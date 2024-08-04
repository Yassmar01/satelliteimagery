import { Show, createSignal, onMount } from 'solid-js';
import './Files.css';

import { BlobReader, TextWriter, ZipReader } from '@zip.js/zip.js';

import drawKml from './kml';
import drawDxf from './dxf';
import ErrorModal from '../ErrorModal/ErrorModal';
import axios from 'axios';
import { currentCountry, project } from '../../global/projections';
import { DxfWriter, LWPolylineFlags, point2d } from '@tarikjabiri/dxf';
import tokml from 'tokml';
import { saveState } from '../../global/entities';

const Files = (props) => {
	const [pointsLoading, setPointsLoading] = createSignal(false);
	const [errorModalOpen, setErrorModalOpen] = createSignal(false);
	const [errorText, setErrorText] = createSignal('');

	const map = props.map;

	let filesModal;

	let modalEl, kmlInput, dxfInput; // refs

	onMount(() => {
		filesModal = bootstrap.Modal.getOrCreateInstance(modalEl);
	});

	const dxfInputHandler = (event) => {
		if (typeof window.FileReader !== 'function') throw "The file API isn't supported on this browser.";
		let input = event.target;
		if (!input) throw 'The browser does not properly implement the event object';
		if (!input.files) throw 'This browser does not support the `files` property of the file input.';
		if (!input.files[0]) return undefined;
		let file = input.files[0];
		let fr = new FileReader();
		fr.onload = function (e) {
			const text = e.target.result;
			dxfInput.value = '';
			const bounds = drawDxf(text, map);
			map.fitBounds(bounds);

			map.once('moveend', () => {
				saveState(map);
			});

			filesModal.hide();
		};
		fr.readAsText(file);
	};

	const kmlInputHandler = (event) => {
		if (typeof window.FileReader !== 'function') throw "The file API isn't supported on this browser.";
		let input = event.target;
		if (!input) throw 'The browser does not properly implement the event object';
		if (!input.files) throw 'This browser does not support the `files` property of the file input.';
		if (!input.files[0]) return undefined;
		let file = input.files[0];
		var extension = input.files[0].name.split('.').pop().toLowerCase();
		let fr = new FileReader();
		fr.onload = function (e) {
			if (extension === 'kmz') {
				const blob = input.files[0];
				kmlInput.value = '';
				unzipBlob(blob, function (str) {
					const bounds = drawKml(new DOMParser().parseFromString(str, 'text/xml'), map);
					map.fitBounds(bounds);
				});
			} else {
				const text = e.target.result;
				kmlInput.value = '';
				const bounds = drawKml(new DOMParser().parseFromString(text, 'text/xml'), map);
				map.fitBounds(bounds);
			}

			map.once('moveend', () => {
				saveState(map);
			});

			filesModal.hide();
		};
		if (extension === 'kmz') {
			fr.readAsDataURL(file);
		} else {
			fr.readAsText(file);
		}
	};

	const exportDxfHandler = () => {
		const dxf = new DxfWriter();

		map.markers.forEach(({ _latlng }) => {
			const { x, y } = project({ lat: _latlng.lat, lng: _latlng.lng });
			dxf.addPoint(x, y, 0);
		});

		map.polylines.forEach((polyline) => {
			const latLngs = polyline._latlngs;
			const vertices = [];
			latLngs.forEach(({ lat, lng }) => {
				const { x, y } = project({ lat, lng });
				vertices.push({ point: point2d(x, y) });
			});

			dxf.addLWPolyline(vertices);
		});

		map.polygons.forEach((polygon) => {
			const latLngs = polygon._latlngs[0];
			const vertices = [];
			latLngs.forEach(({ lat, lng }) => {
				const { x, y } = project({ lat, lng });
				vertices.push({ point: point2d(x, y) });
			});

			dxf.addLWPolyline(vertices, {
				flags: LWPolylineFlags.Closed,
			});
		});

		const text = dxf.stringify();
		let fileName = 'DXF-' + getStringDate() + '.dxf';
		saveTextAsFile(fileName, text);
	};

	const exportKmlHandler = () => {
		let all = L.layerGroup();
		map.markers.forEach((marker) => {
			all.addLayer(marker);
		});

		map.polygons.forEach((polygon) => {
			all.addLayer(polygon);
		});

		map.polylines.forEach((polyline) => {
			all.addLayer(polyline);
		});

		const text = tokml(all.toGeoJSON());
		let fileName = 'KML-' + getStringDate() + '.kml';
		saveTextAsFile(fileName, text);
	};

	const exportPointsHandler = () => {
		const latLngs = [];

		map.markers.forEach((marker) => {
			latLngs.push({ lat: marker._latlng.lat, lng: marker._latlng.lng });
		});

		setPointsLoading(true);
		axios({
			url: '/elevations',
			method: 'POST',
			data: {
				latLngs,
			},
		})
			.then((res) => {
				if (res.data.error) {
					handleError(res.data.message);
				} else {
					let text = '';
					res.data.forEach((p, index) => {
						let projectedPosition = project(p.location);
						const formattedX = currentCountry().country === 'Maroc' ? projectedPosition.x.toFixed(2) : projectedPosition.x.toFixed(6);
						const formattedY = currentCountry().country === 'Maroc' ? projectedPosition.y.toFixed(2) : projectedPosition.y.toFixed(6);
						text += 'P' + (index + 1) + '\t' + formattedX + '\t' + formattedY + '\t' + p.elevation.toFixed(2) + '\tTN\r\n';
					});

					let fileName = 'XYZ-' + getStringDate() + '.txt';
					saveTextAsFile(fileName, text);
				}
			})
			.catch((err) => {
				handleError(err.message);
			})
			.finally(() => {
				setPointsLoading(false);
			});
	};

	const handleError = (message) => {
		setErrorText(message);
		setErrorModalOpen(true);
	};

	return (
		<>
			<button
				class="btn btn-light filesToggle"
				onclick={() => {
					filesModal.show();
				}}
			>
				<i class="bi bi-file-earmark-fill"></i>
			</button>

			<div class="modal fade" ref={modalEl}>
				<div class="modal-dialog modal-dialog-centered">
					<div class="modal-content">
						<div class="modal-header">
							<h5 class="modal-title">Fichiers</h5>
							<button type="button" class="btn-close" data-bs-dismiss="modal"></button>
						</div>
						<div class="modal-body">
							<div class="row">
								<h6 class="text-center">Import</h6>
								<div class="text-center">
									<label for="getDXF" id="import-kml-btn" type="button" class="btn btn-primary">
										DXF
									</label>
									<input ref={dxfInput} style="display: none;" id="getDXF" type="file" accept=".dxf" onchange={dxfInputHandler} />
									&nbsp;
									<label for="getKML" id="import-kml-btn" type="button" class="btn btn-primary">
										KML / KMZ
									</label>
									<input ref={kmlInput} style="display: none;" id="getKML" type="file" accept=".kml, .kmz" onchange={kmlInputHandler} />
								</div>
							</div>
							<div class="row" style={{ 'margin-top': '20px' }}>
								<h6 class="text-center">Export</h6>
								<div class="text-center">
									<button class="btn btn-success" onclick={exportDxfHandler}>
										DXF
									</button>
									&nbsp;
									<button class="btn btn-success" onclick={exportKmlHandler}>
										KML
									</button>
									&nbsp;
									<button class="btn btn-success" onclick={exportPointsHandler}>
										<Show when={pointsLoading()}>
											<span class="spinner-border spinner-border-sm"></span>
											&nbsp;
										</Show>
										<span>Points (TXT)</span>
									</button>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
			<ErrorModal text={errorText} open={errorModalOpen} setOpen={setErrorModalOpen} />
		</>
	);
};

async function unzipBlob(blob, callback) {
	const zipFileReader = new BlobReader(blob);
	const writer = new TextWriter();
	const zipReader = new ZipReader(zipFileReader);
	const firstEntry = (await zipReader.getEntries()).shift();
	const result = await firstEntry.getData(writer);

	zipReader.close();

	callback(result);
}

function saveTextAsFile(filename, data) {
	const blob = new Blob([data], { type: 'application/octet-stream' });
	const elem = window.document.createElement('a');
	elem.href = window.URL.createObjectURL(blob);
	elem.download = filename;
	document.body.appendChild(elem);
	elem.click();
	document.body.removeChild(elem);
}

function getStringDate() {
	var today = new Date();
	var dd = today.getDate();
	var mm = today.getMonth() + 1; //January is 0!

	var yyyy = today.getFullYear();
	if (dd < 10) {
		dd = '0' + dd;
	}
	if (mm < 10) {
		mm = '0' + mm;
	}
	return dd + '-' + mm + '-' + yyyy;
}

export default Files;
