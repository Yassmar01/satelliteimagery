import { For, createEffect, createSignal, onMount } from 'solid-js';
import { currentProjectionName, projectReactive, unproject } from '../../global/projections';
import './GoTo.css';
import { saveState, setupMarker } from '../../global/entities';

function GoTo(props) {
	let gotoModal;

	onMount(() => {
		const modalEl = document.getElementById('goToModalEl');
		gotoModal = bootstrap.Modal.getOrCreateInstance(modalEl);

		modalEl.addEventListener('shown.bs.modal', () => {
			xInput.focus();
			latInput.focus();
		});
	});

	let xInput, yInput, latInput, lngInput;

	const goToHandler = () => {
		gotoModal.show();
	};

	const [invalidProjectedInput, setInvalidProjectedInput] = createSignal(false);
	const [invalidUnprojectedInput, setInvalidUnprojectedInput] = createSignal(false);

	const applyProjectedHandler = () => {
		const x = parseFloat(xInput.value);
		const y = parseFloat(yInput.value);

		if (isNaN(x) || isNaN(y)) {
			setInvalidProjectedInput(true);
		} else {
			setInvalidProjectedInput(false);
			const unprojectedPosition = unproject({ x, y });
			props.map.setView(unprojectedPosition, 14);
			const marker = L.marker(unprojectedPosition);
			marker.addTo(props.map);
			setupMarker(marker, props.map);

			saveState(props.map);

			gotoModal.hide();
		}
	};

	const applyUnprojectedHandler = () => {
		const lat = parseFloat(latInput.value);
		const lng = parseFloat(lngInput.value);

		if (isNaN(lat) || isNaN(lng)) {
			setInvalidUnprojectedInput(true);
		} else {
			setInvalidUnprojectedInput(false);
			props.map.setView({ lat, lng }, 14);
			const marker = L.marker({ lat, lng });
			marker.addTo(props.map);
			setupMarker(marker, props.map);

			saveState(props.map);

			gotoModal.hide();
		}
	};

	return (
		<>
			<a type="button" onClick={goToHandler} style={{ height: '37px' }} class="btn btn-light">
				<i class="bi bi-arrow-right"></i>
			</a>

			<div class="modal fade" id="goToModalEl">
				<div class="modal-dialog">
					<div class="modal-content">
						<div class="modal-header">
							<h5 class="modal-title">Aller à un point</h5>
							<button type="button" class="btn-close" data-bs-dismiss="modal"></button>
						</div>
						<div class="modal-body">
							<nav>
								<div class="nav nav-tabs" id="nav-tab" role="tablist">
									<button class="nav-link active" id="nav-projection-tab" data-bs-toggle="tab" data-bs-target="#nav-projection" type="button" role="tab" aria-controls="nav-projection" aria-selected="true">
										{currentProjectionName}
									</button>
									<button class="nav-link" id="nav-wgs84-tab" data-bs-toggle="tab" data-bs-target="#nav-wgs84" type="button" role="tab" aria-controls="nav-wgs84" aria-selected="false">
										WGS 84
									</button>
								</div>
							</nav>
							<div class="tab-content" id="nav-tabContent">
								<div class="tab-pane fade show active" id="nav-projection" role="tabpanel" aria-labelledby="nav-projection-tab">
									<div class="row mt-3">
										<div class="col-sm">
											<input
												ref={xInput}
												class="form-control text-center"
												type="number"
												placeholder="X"
												onKeyDown={(e) => {
													if (e.key === 'Enter') {
														applyProjectedHandler();
													}
												}}
											/>
										</div>
										<div class="col-sm">
											<input
												ref={yInput}
												class="form-control text-center"
												type="number"
												placeholder="Y"
												onKeyDown={(e) => {
													if (e.key === 'Enter') {
														applyProjectedHandler();
													}
												}}
											/>
										</div>
									</div>
									<div class="row" style={{ display: invalidProjectedInput() ? 'block' : 'none' }}>
										<div class="alert alert-danger mt-3 mb-0" role="alert">
											Vérifiez que les coordonnées sont valides.
										</div>
									</div>
									<button type="button" class="btn btn-primary mt-3" onClick={applyProjectedHandler}>
										Appliquer
									</button>
								</div>
								<div class="tab-pane fade" id="nav-wgs84" role="tabpanel" aria-labelledby="nav-wgs84-tab">
									<div class="row mt-3">
										<div class="col-sm">
											<input
												ref={latInput}
												class="form-control text-center"
												type="number"
												placeholder="Latitude"
												onKeyDown={(e) => {
													if (e.key === 'Enter') {
														applyUnprojectedHandler();
													}
												}}
											/>
										</div>
										<div class="col-sm">
											<input
												ref={lngInput}
												class="form-control text-center"
												type="number"
												placeholder="Longitude"
												onKeyDown={(e) => {
													if (e.key === 'Enter') {
														applyUnprojectedHandler();
													}
												}}
											/>
										</div>
									</div>
									<div class="row" style={{ display: invalidUnprojectedInput() ? 'block' : 'none' }}>
										<div class="alert alert-danger mt-3 mb-0" role="alert">
											Vérifiez que les coordonnées sont valides.
										</div>
									</div>
									<button type="button" class="btn btn-primary mt-3" onClick={applyUnprojectedHandler}>
										Appliquer
									</button>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</>
	);
}

export default GoTo;
