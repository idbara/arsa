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
	<div class="shadow-elevated animate-slide-up modal-box flex flex-col items-center rounded-t-3xl">
		<img src={imgSrc} alt="Receipt" class="max-h-[70vh] w-auto rounded-xl" />
		<div class="modal-action">
			<button class="btn rounded-xl" onclick={onClose}>Close</button>
		</div>
	</div>
	<button class="modal-backdrop bg-black/30" aria-label="Close" onclick={onClose}></button>
</div>
