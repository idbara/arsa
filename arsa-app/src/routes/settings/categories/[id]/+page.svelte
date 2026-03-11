<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';

	let { data, form } = $props();
	let showDeleteConfirm = $state(false);
</script>

<h1 class="heading-xl mb-6">Edit Category</h1>

{#if form?.error}
	<div class="animate-fade-in mb-4 rounded-xl bg-error/10 px-4 py-2.5 text-sm text-error">{form.error}</div>
{/if}

<form method="POST" action="?/update" use:enhance class="flex flex-col gap-4">
	<label class="floating-label">
		<span>Category Name</span>
		<input
			name="name"
			type="text"
			placeholder="Category Name"
			class="input input-bordered w-full rounded-xl"
			value={data.category.name}
			required
		/>
	</label>

	<label class="floating-label">
		<span>Monthly Budget Limit (optional)</span>
		<input
			name="monthly_limit"
			type="number"
			inputmode="decimal"
			placeholder="Monthly Budget Limit (optional)"
			class="input input-bordered w-full rounded-xl"
			value={data.category.monthly_limit ?? ''}
			step="any"
		/>
	</label>

	<label class="label cursor-pointer justify-start gap-3">
		<input
			name="is_child_related"
			type="checkbox"
			class="checkbox"
			checked={data.category.is_child_related}
		/>
		<span class="text-sm">Child-related expense</span>
	</label>

	<div class="flex gap-2">
		<a href={resolve('/settings/categories')} class="btn btn-ghost flex-1 rounded-xl">Cancel</a>
		<button type="submit" class="btn btn-primary flex-1 rounded-xl">Save</button>
	</div>
</form>

<div class="divider"></div>

<button class="btn btn-error btn-outline w-full rounded-xl" onclick={() => (showDeleteConfirm = true)}>
	Delete Category
</button>

{#if showDeleteConfirm}
	<div class="modal modal-open">
		<div class="modal-box rounded-2xl">
			<h3 class="heading-lg">Delete "{data.category.name}"?</h3>
			<p class="text-subtle py-4">
				This cannot be undone. Categories with transactions cannot be deleted.
			</p>
			<div class="modal-action">
				<button class="btn btn-ghost rounded-xl" onclick={() => (showDeleteConfirm = false)}>Cancel</button>
				<form method="POST" action="?/delete" use:enhance>
					<button type="submit" class="btn btn-error rounded-xl">Delete</button>
				</form>
			</div>
		</div>
		<button class="modal-backdrop bg-black/30" aria-label="Close" onclick={() => (showDeleteConfirm = false)}></button>
	</div>
{/if}
