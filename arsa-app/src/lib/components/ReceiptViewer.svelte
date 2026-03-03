<script lang="ts">
	let {
		receiptUrl,
		onClose
	}: {
		receiptUrl: string;
		onClose: () => void;
	} = $props();

	let imgSrc = $derived(`/api/receipts/${receiptUrl}`);
</script>

<div class="modal modal-open">
	<div class="modal-box flex flex-col items-center">
		<img src={imgSrc} alt="Receipt" class="max-h-[70vh] w-auto rounded-lg" />
		<div class="modal-action">
			<button class="btn" onclick={onClose}>Close</button>
		</div>
	</div>
	<button class="modal-backdrop" aria-label="Close" onclick={onClose}></button>
</div>
