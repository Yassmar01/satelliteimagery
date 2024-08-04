import styles from './App.module.css';
import logo from './assets/logo.png';
import restoreIcon from './assets/restoreIcon.png';

import { createSignal, getOwner, onMount, Show } from 'solid-js';
import { setupMarker, setupPolyline, setupPolygon, updatePolygonsOrder, saveState, loadState } from './global/entities';
import L from 'leaflet';
import './Utils/MousePosition';
import './Utils/MousePosition/index.css';

import 'leaflet.pm';
import 'leaflet.pm/dist/leaflet.pm.css';

import 'leaflet.locatecontrol';
import 'leaflet.locatecontrol/dist/L.Control.Locate.min.css';

import 'leaflet/dist/leaflet.css';

import icon from 'leaflet/dist/images/marker-icon-2x.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import Projection from './Components/Projection/Projection';
import GoTo from './Components/GoTo/GoTo';
import { currentCountry, project } from './global/projections';
import Files from './Components/Files/Files';
import PointScatter from './Components/PointScatter/PointScatter';
import ErrorModal from './Components/ErrorModal/ErrorModal';
import Country from './Components/Country/Country';

let [iconWidth, iconHeight] = L.Marker.prototype.options.icon.options.iconSize;
let [iconAnchorX, iconAnchorY] = L.Marker.prototype.options.icon.options.iconAnchor;

let DefaultIcon = L.icon({
	iconSize: [iconWidth, iconHeight],
	iconAnchor: [iconAnchorX, iconAnchorY],
	iconUrl: icon,
	shadowUrl: iconShadow,
	className: styles.defaultMarker,
});

L.Marker.prototype.options.icon = DefaultIcon;
L.Marker.maxPointClassName = styles.maxPointMarker;
L.Marker.minPointClassName = styles.minPointMarker;

function App() {
	let [map, setMap] = createSignal();
	let [pointScatterPolygon, setPointScatterPolygon] = createSignal(null);
	let [splashVisible, setSplashVisible] = createSignal(true);
	const [errorModalOpen, setErrorModalOpen] = createSignal(false);
	const [errorText, setErrorText] = createSignal('');

	const cachedStateExists = !!localStorage.getItem('cached');

	let splash, progressBar, splashMenu;
	const hideSplash = () => {
		splash.style.opacity = 0;
		setTimeout(() => {
			setSplashVisible(false);
		}, 500);
	};

	window.onload = () => {
		setTimeout(() => {
			progressBar.style.opacity = 0;
			splashMenu.style.maxHeight = '150px';
			setTimeout(() => {
				splashMenu.style.opacity = 1;
			}, 200);
		}, 1000);
	};

	onMount(() => {
		setMap(
			L.map('map', {
				attributionControl: false,
			})
		);

		map().owner = getOwner();

		map().createPointScatter = (polygon) => {
			polygon.closePopup();
			if (!pointScatterPolygon()) {
				setPointScatterPolygon(polygon);
			}
		};

		map().markers = [];
		map().minPoints = [];
		map().maxPoints = [];
		map().polygons = [];
		map().polylines = [];

		map().fitBounds([
			[20.620095, -17.490234],
			[36.347456, -0.791016],
		]);

		L.control
			.mousePosition({
				formatter: (lng, lat) => {
					const projectedPosition = project({ lat, lng });
					const formattedX = currentCountry().country === 'Maroc' ? projectedPosition.x.toFixed(2) : projectedPosition.x.toFixed(6);
					const formattedY = currentCountry().country === 'Maroc' ? projectedPosition.y.toFixed(2) : projectedPosition.y.toFixed(6);
					return '<div style="font-size: 13px; font-weight: bold">' + 'X : ' + formattedX + ' | Y : ' + formattedY + '</div>';
				},
			})
			.addTo(map());

		map().pm.setLang('fr');
		map().pm.addControls({
			position: 'topleft',
			drawMarker: true,
			drawPolyline: true,
			drawRectangle: false,
			drawPolygon: true,
			drawCircle: false,
			cutPolygon: false,
			editMode: false,
			dragMode: false,
			removalMode: true,
			drawCircleMarker: false,
		});

		map().pm.enableDraw('Polygon', {
			templineStyle: { color: '#91e400' },
			hintlineStyle: { color: '#91e400', dashArray: [5, 5] },
			snappable: true,
			snapDistance: 10,
		});
		map().pm.disableDraw('Polygon');

		map().pm.enableDraw('Line', {
			templineStyle: { color: '#00a8ff' },
			hintlineStyle: { color: '#00a8ff', dashArray: [5, 5] },
			snappable: true,
			snapDistance: 10,
		});
		map().pm.disableDraw('Line');

		map().pm.enableDraw('Marker', {
			snappable: true,
			snapDistance: 10,
		});
		map().pm.disableDraw('Marker');

		map().on('pm:create', (e) => {
			switch (e.shape) {
				case 'Line':
					setupPolyline(e.layer, map());
					break;

				case 'Polygon':
					setupPolygon(e.layer, map(), setErrorText, setErrorModalOpen);
					updatePolygonsOrder(map());
					break;

				case 'Marker':
					setupMarker(e.layer, map());
					break;

				default:
					break;
			}

			saveState(map());
		});

		map().on('pm:drawstart', function () {
			map().markers.forEach(function (marker) {
				marker.unbindPopup();
			});

			map().polygons.forEach(function (polygon) {
				polygon.unbindPopup();
			});

			map().polylines.forEach(function (polyline) {
				polyline.unbindPopup();
			});
		});

		map().on('pm:drawend', function () {
			map().markers.forEach(function (marker) {
				marker.bindPopup(marker.popup);
			});

			map().polygons.forEach(function (polygon) {
				polygon.bindPopup(polygon.popup);
			});

			map().polylines.forEach(function (polyline) {
				polyline.bindPopup(polyline.popup);
			});
		});

		L.control
			.locate({
				icon: 'bi bi-crosshair2',
				position: 'topright',
				compassStyle: { stroke: true, weight: 1, color: '#fff' },
				maxZoom: 17,
				locateOptions: { enableHighAccuracy: true, maxZoom: 17 },
				showPopup: false,
			})
			.addTo(map());

		let googleTerrain = L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
			maxZoom: 9,
			subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
		}).addTo(map());

		let labelLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
			maxZoom: 9,
			zoomAnimation: false,
		}).addTo(map());

		let googleHybrid = L.tileLayer('https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}', {
			maxNativeZoom: 20,
			minZoom: 10,
			maxZoom: 22,
			subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
		}).addTo(map());
	});

	return (
		<div class={styles.App}>
			<Show when={splashVisible()}>
				<div ref={splash} class={styles.splash}>
					<div class={styles.logo} style={{ 'background-image': `url(${logo})` }}></div>
					<div ref={progressBar} class={styles.progressBar}>
						<div>
							<div></div>
						</div>
					</div>
					<div ref={splashMenu} class={styles.splashMenu}>
						<Country style={{ width: '326px', margin: '0 auto 10px auto' }}></Country>
						<Projection style={{ display: 'inline-block', 'margin-left': '12px', height: '37px', width: '200px', 'vertical-align': 'middle' }}></Projection>
						<button style={{ width: '120px', 'margin-left': '7px' }} class="btn btn-primary" onClick={hideSplash}>
							Commencer
						</button>
						<Show when={cachedStateExists}>
							<div class="text-center" style={{ 'margin-top': '23px' }}>
								<button
									class="btn btn-success"
									style={{ width: '330px', 'background-color': '#34a300' }}
									onClick={() => {
										loadState(map(), setErrorText, setErrorModalOpen);
										hideSplash();
									}}
								>
									<span style={{ display: 'inline-block', 'background-image': `url(${restoreIcon})`, 'background-size': 'contain', 'background-repeat': 'no-repeat', 'vertical-align': 'bottom', width: '23px', height: '23px' }} />
									&nbsp;Restaurer les données
								</button>
							</div>
						</Show>
					</div>
				</div>
			</Show>

			<div id="map" class={styles.map}></div>
			<Show when={map()}>
				<Files map={map()} />
				<div class={styles.projection_goto}>
					<Country style={{ display: 'inline-block', width: '180px', height: '37px', 'vertical-align': 'middle' }}></Country>
					<div style={{ display: 'inline-block' }}>
						<Projection style={{ display: 'inline-block', height: '37px', width: '180px', 'vertical-align': 'middle' }}></Projection>
						<GoTo map={map()}></GoTo>
					</div>
				</div>
				<PointScatter polygon={pointScatterPolygon} setPolygon={setPointScatterPolygon} map={map()} />
			</Show>

			<ErrorModal text={errorText} open={errorModalOpen} setOpen={setErrorModalOpen} />
		</div>
	);
}

export default App;
