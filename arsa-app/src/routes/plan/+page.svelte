<script lang="ts">
	import { resolve } from '$app/paths';

	let { data } = $props();

	const monthName = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

	const categoryColors = [
		'#6366f1', '#f43f5e', '#f59e0b', '#10b981', '#8b5cf6',
		'#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#84cc16'
	];

	function getCategoryColor(name: string): string {
		let hash = 0;
		for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
		return categoryColors[Math.abs(hash) % categoryColors.length];
	}

	function formatRp(amount: number): string {
		return `Rp ${amount.toLocaleString('id-ID')}`;
	}

	function dueBadgeClass(daysUntil: number): string {
		if (daysUntil <= 3) return 'bg-warning text-warning-content';
		return 'bg-base-200 text-base-content/70';
	}

	function dueLabel(daysUntil: number, date: string): string {
		if (daysUntil === 0) return 'Hari ini!';
		if (daysUntil === 1) return 'Besok!';
		const d = new Date(date + 'T00:00:00');
		return `${d.getDate()}/${d.getMonth() + 1}`;
	}
</script>

<h1 class="heading-xl mb-6">Plan</h1>

<div class="mb-6">
	<h2 class="heading-md mb-3">Child Expenses — {monthName}</h2>

	{#if data.childExpenses.length === 0}
		<div class="text-subtle py-6 text-center">
			<p>No child-related categories found.</p>
			<p class="text-sm">Mark categories as "child-related" in Settings.</p>
		</div>
	{:else}
		<div class="mb-4 rounded-2xl border border-secondary/10 bg-secondary/5 p-4">
			<p class="text-subtle text-xs font-medium uppercase tracking-wider">Total Child Spending</p>
			<p class="mt-1 font-mono text-2xl font-bold">
				{formatRp(data.totalChildSpending)}
			</p>
			<p class="text-subtle mt-1 text-xs">This month</p>
		</div>

		<div class="flex flex-col gap-2">
			{#each data.childExpenses as expense (expense.name)}
				<div class="flex items-center justify-between rounded-xl bg-base-200/30 p-3">
					<div class="flex items-center gap-2">
						<span
							class="inline-block size-2.5 rounded-full"
							style="background-color: {getCategoryColor(expense.name)}"
						></span>
						<span class="text-sm font-medium">{expense.name}</span>
					</div>
					<span class="font-mono text-sm">{formatRp(expense.spent)}</span>
				</div>
			{/each}
		</div>
	{/if}
</div>

<div class="divider"></div>

<!-- Subscription summary card -->
{#if data.subscriptionSummary.activeCount > 0}
	<a
		href={resolve('/plan/subscriptions')}
		class="mb-4 block rounded-2xl border border-primary/10 bg-primary/5 p-4 press-scale"
	>
		<div class="flex items-center justify-between">
			<div class="flex items-center gap-3">
				<div class="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-lg">
					🔄
				</div>
				<div>
					<p class="text-sm font-semibold">Langganan</p>
					<p class="text-subtle text-xs">
						{data.subscriptionSummary.activeCount} aktif · {formatRp(data.subscriptionSummary.monthlyTotal)}/bln
					</p>
				</div>
			</div>
			<span class="text-base-content/30">›</span>
		</div>
		{#if data.subscriptionSummary.upcoming.length > 0}
			<div class="mt-3 flex flex-wrap gap-1.5 border-t border-primary/10 pt-3">
				{#each data.subscriptionSummary.upcoming as item (item.name)}
					<span class="rounded-full px-2 py-0.5 text-[10px] font-semibold {dueBadgeClass(item.daysUntil)}">
						{item.name} {dueLabel(item.daysUntil, item.next_due_date)}
					</span>
				{/each}
			</div>
		{/if}
	</a>
{:else}
	<a
		href={resolve('/plan/subscriptions')}
		class="mb-4 flex items-center gap-3 rounded-xl border border-base-200 p-4 press-scale"
	>
		<span class="text-lg">🔄</span>
		<span class="text-sm font-medium">Kelola Langganan</span>
	</a>
{/if}

<a href={resolve('/plan/forecast')} class="mb-4 flex items-center gap-3 rounded-xl border border-base-200 p-4 press-scale">
	<svg
		xmlns="http://www.w3.org/2000/svg"
		class="size-5 text-primary"
		fill="none"
		viewBox="0 0 24 24"
		stroke="currentColor"
	>
		<path
			stroke-linecap="round"
			stroke-linejoin="round"
			stroke-width="2"
			d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
		/>
	</svg>
	<div>
		<span class="text-sm font-medium">Proyeksi Keuangan</span>
		<span class="text-subtle block text-xs">Estimasi 3 bulan ke depan</span>
	</div>
</a>

<a href={resolve('/plan/education')} class="flex items-center gap-3 rounded-xl border border-base-200 p-4 press-scale">
	<svg
		xmlns="http://www.w3.org/2000/svg"
		class="size-5 text-primary"
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
	<span class="text-sm font-medium">Education Cost Projection</span>
</a>
