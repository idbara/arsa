<script lang="ts">
	import { resolve } from '$app/paths';

	let { data } = $props();

	const monthName = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
</script>

<h1 class="mb-6 text-2xl font-bold">Plan</h1>

<div class="mb-6">
	<h2 class="mb-3 text-lg font-bold">Child Expenses — {monthName}</h2>

	{#if data.childExpenses.length === 0}
		<div class="py-6 text-center text-base-content/60">
			<p>No child-related categories found.</p>
			<p class="text-sm">Mark categories as "child-related" in Settings.</p>
		</div>
	{:else}
		<div class="stats mb-4 w-full shadow">
			<div class="stat">
				<div class="stat-title">Total Child Spending</div>
				<div class="stat-value text-secondary">
					Rp {data.totalChildSpending.toLocaleString('id-ID')}
				</div>
				<div class="stat-desc">This month</div>
			</div>
		</div>

		<div class="flex flex-col gap-2">
			{#each data.childExpenses as expense (expense.name)}
				<div class="flex items-center justify-between border-b border-base-200 py-2">
					<span class="font-medium">{expense.name}</span>
					<span class="font-mono">Rp {expense.spent.toLocaleString('id-ID')}</span>
				</div>
			{/each}
		</div>
	{/if}
</div>

<div class="divider"></div>

<a href={resolve('/plan/education')} class="btn btn-outline w-full gap-2">
	<svg
		xmlns="http://www.w3.org/2000/svg"
		class="size-5"
		fill="none"
		viewBox="0 0 24 24"
		stroke="currentColor"
	>
		<path
			stroke-linecap="round"
			stroke-linejoin="round"
			stroke-width="2"
			d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 0 1 .665 6.479A11.952 11.952 0 0 0 12 20.055a11.952 11.952 0 0 0-6.824-2.998 12.078 12.078 0 0 1 .665-6.479L12 14zm-4 6v-7.5l4-2.222"
		/>
	</svg>
	Education Cost Projection
</a>
