<script lang="ts">
	let { open = $bindable(false) }: { open: boolean } = $props();
</script>

<dialog class="modal" class:modal-open={open}>
	<div class="modal-box">
		<h3 class="text-lg font-bold">Propose a Reward</h3>
		<form method="POST" action="?/propose" class="flex flex-col gap-3 pt-4">
			<label class="floating-label">
				<span>Reward Name</span>
				<input
					name="name"
					type="text"
					placeholder="Reward Name"
					class="input input-bordered w-full"
					required
				/>
			</label>
			<label class="floating-label">
				<span>Description</span>
				<textarea
					name="description"
					placeholder="Description"
					class="textarea textarea-bordered w-full"
				></textarea>
			</label>
			<label class="floating-label">
				<span>Point Cost</span>
				<input
					name="point_cost"
					type="number"
					min="1"
					placeholder="Point Cost"
					class="input input-bordered w-full"
					required
				/>
			</label>
			<div class="modal-action">
				<button type="button" class="btn btn-ghost" onclick={() => (open = false)}>Cancel</button>
				<button type="submit" class="btn btn-primary">Propose</button>
			</div>
		</form>
	</div>
	<button class="modal-backdrop" aria-label="Close" onclick={() => (open = false)}></button>
</dialog>
