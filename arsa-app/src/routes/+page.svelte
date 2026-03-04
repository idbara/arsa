<script lang="ts">
	import { resolve } from '$app/paths';
	import StreakIndicator from '$lib/components/StreakIndicator.svelte';
	import WealthTab from '$lib/components/WealthTab.svelte';

	let { data } = $props();

	let activeTab = $state<'cashflow' | 'wealth'>('cashflow');

	function budgetColor(spent: number, limit: number): string {
		const pct = spent / limit;
		if (pct > 0.9) return 'progress-error';
		if (pct > 0.75) return 'progress-warning';
		return 'progress-success';
	}

	function formatAmount(amount: number, type: string): string {
		const formatted = `Rp ${Math.abs(amount).toLocaleString('id-ID')}`;
		if (type === 'in') return `+${formatted}`;
		if (type === 'out') return `-${formatted}`;
		return formatted;
	}

	function amountColor(type: string): string {
		if (type === 'in') return 'text-success';
		if (type === 'out') return 'text-error';
		return 'text-info';
	}
</script>

<div role="tablist" class="tabs tabs-bordered mb-6">
	<button
		role="tab"
		class="tab"
		class:tab-active={activeTab === 'cashflow'}
		onclick={() => (activeTab = 'cashflow')}
	>
		Cash Flow
	</button>
	<button
		role="tab"
		class="tab"
		class:tab-active={activeTab === 'wealth'}
		onclick={() => (activeTab = 'wealth')}
	>
		Wealth
	</button>
</div>

{#if activeTab === 'cashflow'}
	<div class="stats mb-6 w-full shadow">
		<div class="stat">
			<div class="stat-title">Total Balance</div>
			<div class="stat-value text-primary">
				Rp {data.totalBalance.toLocaleString('id-ID')}
			</div>
		</div>
	</div>

	{#if data.budgets.length > 0}
		<h2 class="mb-3 text-lg font-bold">Monthly Budget</h2>
		<div class="mb-6 flex flex-col gap-3">
			{#each data.budgets as budget (budget.name)}
				<div>
					<div class="mb-1 flex justify-between text-sm">
						<span>{budget.name}</span>
						<span class="font-mono text-base-content/60">
							Rp {budget.spent.toLocaleString('id-ID')} / {budget.limit.toLocaleString('id-ID')}
						</span>
					</div>
					<progress
						class="progress w-full {budgetColor(budget.spent, budget.limit)}"
						value={Math.min(budget.spent, budget.limit)}
						max={budget.limit}
					></progress>
				</div>
			{/each}
		</div>
	{/if}

	<div class="mb-3 flex items-center justify-between">
		<h2 class="text-lg font-bold">Recent</h2>
		<a href={resolve('/history')} class="link link-primary text-sm">View all</a>
	</div>

	{#if data.recentTransactions.length === 0}
		<p class="py-6 text-center text-base-content/60">No transactions yet. Tap + to add one.</p>
	{:else}
		<div class="flex flex-col gap-1">
			{#each data.recentTransactions as tx (tx.id)}
				<div class="flex items-center justify-between border-b border-base-200 py-2">
					<div>
						<p class="text-sm font-medium">
							{tx.is_private && !tx.merchant
								? 'Private'
								: tx.merchant ||
									(tx.categories as unknown as { name: string })?.name ||
									'Uncategorized'}
						</p>
						<p class="text-xs text-base-content/60">
							{(tx.accounts as unknown as { name: string })?.name} · {tx.date}
						</p>
					</div>
					<span class="font-mono text-sm font-bold {amountColor(tx.type)}">
						{formatAmount(Number(tx.amount), tx.type)}
					</span>
				</div>
			{/each}
		</div>
	{/if}

	{#if data.gamification}
		<a href={resolve('/gamification')} class="card mt-4 bg-base-200">
			<div class="card-body flex-row items-center justify-between p-4">
				<div>
					<p class="text-sm font-bold">Points</p>
					<p class="text-2xl font-bold text-primary">{data.gamification.current_points}</p>
				</div>
				<StreakIndicator days={data.gamification.streak_days} />
			</div>
		</a>
	{/if}
{:else}
	<WealthTab investments={data.investments} marketRates={data.marketRates} />
{/if}
