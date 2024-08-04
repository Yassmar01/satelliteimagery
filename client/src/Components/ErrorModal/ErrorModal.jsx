import { createEffect, onMount } from 'solid-js';

const ErrorModal = (props) => {
	let errorModal, modalEl;

	onMount(() => {
		errorModal = bootstrap.Modal.getOrCreateInstance(modalEl);

		modalEl.addEventListener('hidden.bs.modal', () => {
			props.setOpen(false);
		});
	});

	createEffect(() => {
		if (props.open()) {
			errorModal.show();
		}
	});

	return (
		<div class="modal fade" ref={modalEl}>
			<div class="modal-dialog modal-dialog-centered">
				<div class="modal-content">
					<div class="modal-header">
						<h5 class="modal-title">Erreur</h5>
						<button type="button" class="btn-close" data-bs-dismiss="modal"></button>
					</div>
					<div class="modal-body">{props.text}</div>
					<div class="modal-footer">
						<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
							Fermer
						</button>
					</div>
				</div>
			</div>
		</div>
	);
};

export default ErrorModal;
