<script lang="ts">
	import { resolve } from '$app/paths';

	let { data } = $props();
</script>

<div class="mb-6 flex items-center justify-between">
	<h1 class="heading-xl">Categories</h1>
	{#if data.isAdmin}
		<a href={resolve('/settings/categories/new')} class="btn btn-primary btn-sm rounded-xl">+ Add</a>
	{/if}
</div>

{#if data.categories.length === 0}
	<div class="text-subtle py-10 text-center">
		<p>No categories yet.</p>
		{#if data.isAdmin}
			<a href={resolve('/settings/categories/new')} class="font-medium text-primary">
				Create your first category
			</a>
		{/if}
	</div>
{:else}
	<div class="flex flex-col gap-2">
		{#each data.categories as category (category.id)}
			{#if data.isAdmin}
				<a
					href={resolve('/settings/categories/[id]', { id: category.id })}
					class="shadow-soft rounded-xl bg-base-100 press-scale"
				>
					<div class="flex items-center justify-between p-4">
						<div class="flex items-center gap-2">
							<p class="text-sm font-medium">{category.name}</p>
							{#if category.is_child_related}
								<span class="rounded-full bg-secondary/10 px-2 py-0.5 text-[10px] font-medium text-secondary">Child</span>
							{/if}
						</div>
						{#if category.monthly_limit}
							<p class="text-subtle font-mono text-xs">
								Rp {Number(category.monthly_limit).toLocaleString('id-ID')}/mo
							</p>
						{/if}
					</div>
				</a>
			{:else}
				<div class="shadow-soft rounded-xl bg-base-100">
					<div class="flex items-center justify-between p-4">
						<div class="flex items-center gap-2">
							<p class="text-sm font-medium">{category.name}</p>
							{#if category.is_child_related}
								<span class="rounded-full bg-secondary/10 px-2 py-0.5 text-[10px] font-medium text-secondary">Child</span>
							{/if}
						</div>
						{#if category.monthly_limit}
							<p class="text-subtle font-mono text-xs">
								Rp {Number(category.monthly_limit).toLocaleString('id-ID')}/mo
							</p>
						{/if}
					</div>
				</div>
			{/if}
		{/each}
	</div>
{/if}
