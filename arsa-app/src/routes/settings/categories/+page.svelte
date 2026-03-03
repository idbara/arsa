<script lang="ts">
	import { resolve } from '$app/paths';

	let { data } = $props();
</script>

<div class="mb-6 flex items-center justify-between">
	<h1 class="text-2xl font-bold">Categories</h1>
	{#if data.isAdmin}
		<a href={resolve('/settings/categories/new')} class="btn btn-primary btn-sm">+ Add</a>
	{/if}
</div>

{#if data.categories.length === 0}
	<div class="py-10 text-center text-base-content/60">
		<p>No categories yet.</p>
		{#if data.isAdmin}
			<a href={resolve('/settings/categories/new')} class="link link-primary"
				>Create your first category</a
			>
		{/if}
	</div>
{:else}
	<div class="flex flex-col gap-2">
		{#each data.categories as category (category.id)}
			{#if data.isAdmin}
				<a
					href={resolve('/settings/categories/[id]', { id: category.id })}
					class="card bg-base-100 shadow-sm"
				>
					<div class="card-body flex-row items-center justify-between p-4">
						<div class="flex items-center gap-2">
							<p class="font-medium">{category.name}</p>
							{#if category.is_child_related}
								<span class="badge badge-secondary badge-sm">Child</span>
							{/if}
						</div>
						{#if category.monthly_limit}
							<p class="text-sm text-base-content/60">
								Rp {Number(category.monthly_limit).toLocaleString('id-ID')}/mo
							</p>
						{/if}
					</div>
				</a>
			{:else}
				<div class="card bg-base-100 shadow-sm">
					<div class="card-body flex-row items-center justify-between p-4">
						<div class="flex items-center gap-2">
							<p class="font-medium">{category.name}</p>
							{#if category.is_child_related}
								<span class="badge badge-secondary badge-sm">Child</span>
							{/if}
						</div>
						{#if category.monthly_limit}
							<p class="text-sm text-base-content/60">
								Rp {Number(category.monthly_limit).toLocaleString('id-ID')}/mo
							</p>
						{/if}
					</div>
				</div>
			{/if}
		{/each}
	</div>
{/if}
