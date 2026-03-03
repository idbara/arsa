<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';

	let { data, form } = $props();
	let showDeleteConfirm = $state(false);
</script>

<h1 class="mb-6 text-2xl font-bold">Edit Category</h1>

{#if form?.error}
	<div class="alert alert-error mb-4 text-sm">{form.error}</div>
{/if}

<form method="POST" action="?/update" use:enhance class="flex flex-col gap-4">
	<label class="floating-label">
		<span>Category Name</span>
		<input
			name="name"
			type="text"
			placeholder="Category Name"
			class="input input-bordered w-full"
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
			class="input input-bordered w-full"
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
		<span class="label-text">Child-related expense</span>
	</label>

	<div class="flex gap-2">
		<a href={resolve('/settings/categories')} class="btn btn-ghost flex-1">Cancel</a>
		<button type="submit" class="btn btn-primary flex-1">Save</button>
	</div>
</form>

<div class="divider"></div>

<button class="btn btn-error btn-outline w-full" onclick={() => (showDeleteConfirm = true)}>
	Delete Category
</button>

{#if showDeleteConfirm}
	<div class="modal modal-open">
		<div class="modal-box">
			<h3 class="text-lg font-bold">Delete "{data.category.name}"?</h3>
			<p class="py-4 text-base-content/60">
				This cannot be undone. Categories with transactions cannot be deleted.
			</p>
			<div class="modal-action">
				<button class="btn btn-ghost" onclick={() => (showDeleteConfirm = false)}>Cancel</button>
				<form method="POST" action="?/delete" use:enhance>
					<button type="submit" class="btn btn-error">Delete</button>
				</form>
			</div>
		</div>
		<button class="modal-backdrop" aria-label="Close" onclick={() => (showDeleteConfirm = false)}
		></button>
	</div>
{/if}
