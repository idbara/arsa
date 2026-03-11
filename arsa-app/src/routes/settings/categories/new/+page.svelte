<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';

	let { form } = $props();
</script>

<h1 class="heading-xl mb-6">Add Category</h1>

{#if form?.error}
	<div class="animate-fade-in mb-4 rounded-xl bg-error/10 px-4 py-2.5 text-sm text-error">{form.error}</div>
{/if}

<form method="POST" use:enhance class="flex flex-col gap-4">
	<label class="floating-label">
		<span>Category Name</span>
		<input
			name="name"
			type="text"
			placeholder="Category Name"
			class="input input-bordered w-full rounded-xl"
			value={form?.name ?? ''}
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
			value={form?.monthlyLimit ?? ''}
			step="any"
		/>
	</label>

	<label class="label cursor-pointer justify-start gap-3">
		<input
			name="is_child_related"
			type="checkbox"
			class="checkbox"
			checked={form?.isChildRelated ?? false}
		/>
		<span class="text-sm">Child-related expense</span>
	</label>

	<div class="flex gap-2">
		<a href={resolve('/settings/categories')} class="btn btn-ghost flex-1 rounded-xl">Cancel</a>
		<button type="submit" class="btn btn-primary flex-1 rounded-xl">Create</button>
	</div>
</form>
