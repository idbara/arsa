<script lang="ts">
	let { open = $bindable(false) }: { open: boolean } = $props();
</script>

<dialog class="modal" class:modal-open={open}>
	<div class="shadow-elevated animate-slide-up modal-box rounded-t-3xl">
		<h3 class="heading-lg">Propose a Reward</h3>
		<form method="POST" action="?/propose" class="flex flex-col gap-3 pt-4">
			<label class="floating-label">
				<span>Reward Name</span>
				<input
					name="name"
					type="text"
					placeholder="Reward Name"
					class="input input-bordered w-full rounded-xl"
					required
				/>
			</label>
			<label class="floating-label">
				<span>Description</span>
				<textarea
					name="description"
					placeholder="Description"
					class="textarea textarea-bordered w-full rounded-xl"
				></textarea>
			</label>
			<label class="floating-label">
				<span>Point Cost</span>
				<input
					name="point_cost"
					type="number"
					min="1"
					placeholder="Point Cost"
					class="input input-bordered w-full rounded-xl"
					required
				/>
			</label>
			<div class="modal-action">
				<button type="button" class="btn btn-ghost rounded-xl" onclick={() => (open = false)}>Cancel</button>
				<button type="submit" class="btn btn-primary rounded-xl">Propose</button>
			</div>
		</form>
	</div>
	<button class="modal-backdrop bg-black/30" aria-label="Close" onclick={() => (open = false)}></button>
</dialog>
