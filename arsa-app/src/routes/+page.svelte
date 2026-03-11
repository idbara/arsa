<script lang="ts">
	import { resolve } from '$app/paths';
	import StreakIndicator from '$lib/components/StreakIndicator.svelte';
	import WealthTab from '$lib/components/WealthTab.svelte';
	import {
		Chart as ChartJS,
		CategoryScale,
		LinearScale,
		PointElement,
		LineElement,
		Filler,
		ArcElement,
		Tooltip,
		Legend
	} from 'chart.js';

	ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, ArcElement, Tooltip, Legend);

	let { data } = $props();

	let activeTab = $state<'cashflow' | 'wealth'>('cashflow');

	const categoryColors = [
		'#6366f1', '#f43f5e', '#f59e0b', '#10b981', '#8b5cf6',
		'#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#84cc16'
	];

	function getCategoryColor(name: string): string {
		let hash = 0;
		for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
		return categoryColors[Math.abs(hash) % categoryColors.length];
	}

	function budgetColor(spent: number, limit: number): string {
		const pct = spent / limit;
		if (pct > 0.8) return 'progress-error';
		if (pct > 0.5) return 'progress-warning';
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

	function formatRp(amount: number): string {
		return `Rp ${amount.toLocaleString('id-ID')}`;
	}

	const donutData = $derived.by(() => {
		const cats = data.categoryBreakdown;
		if (cats.length <= 8) return cats;
		const top8 = cats.slice(0, 8);
		const rest = cats.slice(8);
		const restTotal = rest.reduce((s: number, c: { total: number }) => s + c.total, 0);
		const totalExpense = cats.reduce((s: number, c: { total: number }) => s + c.total, 0);
		return [
			...top8,
			{
				id: '__other__',
				name: 'Lainnya',
				total: restTotal,
				percentage: totalExpense > 0 ? Math.round((restTotal / totalExpense) * 100) : 0
			}
		];
	});

	// Balance trend line chart
	let trendCanvas = $state<HTMLCanvasElement | null>(null);
	let trendChart = $state<ChartJS | null>(null);

	$effect(() => {
		if (!trendCanvas || data.balanceTrend.length === 0) return;
		trendChart?.destroy();

		const labels = data.balanceTrend.map((p: { date: string }, i: number) => {
			if (i % 7 === 0 || i === data.balanceTrend.length - 1) {
				const d = new Date(p.date + 'T00:00:00');
				return `${d.getDate()}/${d.getMonth() + 1}`;
			}
			return '';
		});

		trendChart = new ChartJS(trendCanvas, {
			type: 'line',
			data: {
				labels,
				datasets: [
					{
						data: data.balanceTrend.map((p: { balance: number }) => p.balance),
						borderColor: '#6366f1',
						backgroundColor: 'rgba(99,102,241,0.08)',
						fill: true,
						tension: 0.3,
						pointRadius: 0,
						pointHoverRadius: 4,
						borderWidth: 2
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					legend: { display: false },
					tooltip: {
						callbacks: {
							label: (ctx) => formatRp(ctx.parsed.y ?? 0)
						}
					}
				},
				scales: {
					y: { display: false },
					x: {
						grid: { display: false },
						ticks: { maxRotation: 0, font: { size: 10 } }
					}
				}
			}
		});

		return () => {
			trendChart?.destroy();
		};
	});

	// Expense doughnut chart
	let donutCanvas = $state<HTMLCanvasElement | null>(null);
	let donutChart = $state<ChartJS | null>(null);

	$effect(() => {
		if (!donutCanvas || donutData.length === 0) return;
		donutChart?.destroy();

		donutChart = new ChartJS(donutCanvas, {
			type: 'doughnut',
			data: {
				labels: donutData.map((c) => c.name),
				datasets: [
					{
						data: donutData.map((c) => c.total),
						backgroundColor: categoryColors.slice(0, donutData.length),
						borderWidth: 0
					}
				]
			},
			options: {
				responsive: true,
				plugins: {
					legend: { display: false },
					tooltip: {
						callbacks: {
							label: (ctx) => `${ctx.label}: ${formatRp(ctx.parsed)}`
						}
					}
				},
				cutout: '65%'
			}
		});

		return () => {
			donutChart?.destroy();
		};
	});

	// Supabase returns union types for join queries; narrow for WealthTab props
	const typedInvestments = $derived(data.investments as any[]);
	const typedMarketRates = $derived(data.marketRates as any[]);
</script>

<!-- Tab switcher -->
<div class="mb-6 rounded-xl bg-base-200/50 p-1">
	<div class="flex">
		<button
			class="flex-1 rounded-lg px-4 py-2 text-sm transition-all {activeTab === 'cashflow' ? 'shadow-soft bg-base-100 font-medium text-base-content' : 'text-base-content/50'}"
			onclick={() => (activeTab = 'cashflow')}
		>
			Cash Flow
		</button>
		<button
			class="flex-1 rounded-lg px-4 py-2 text-sm transition-all {activeTab === 'wealth' ? 'shadow-soft bg-base-100 font-medium text-base-content' : 'text-base-content/50'}"
			onclick={() => (activeTab = 'wealth')}
		>
			Wealth
		</button>
	</div>
</div>

{#if activeTab === 'cashflow'}
	<!-- 1. Saldo hari ini -->
	<div class="mb-4 rounded-2xl border border-primary/10 bg-primary/5 p-5">
		<p class="text-subtle mb-1 text-xs font-medium uppercase tracking-wider">Saldo hari ini</p>
		<p class="font-mono text-3xl font-bold text-base-content">
			{formatRp(data.totalBalance)}
		</p>
	</div>

	<!-- 2. Tren saldo (30 days) -->
	{#if data.balanceTrend.length > 0}
		<div class="shadow-soft mb-4 rounded-2xl bg-base-100 p-3">
			<h2 class="heading-md text-subtle mb-2">Tren saldo</h2>
			<div style="height: 120px;">
				<canvas bind:this={trendCanvas}></canvas>
			</div>
		</div>
	{/if}

	<!-- 3. Arus kas -->
	<div class="mb-4">
		<div class="mb-2 flex items-center justify-between">
			<h2 class="heading-md text-subtle">Arus kas</h2>
			<a href={resolve('/cashflow')} class="text-xs font-medium text-primary">Detail →</a>
		</div>
		<div class="grid grid-cols-2 gap-2">
			<div class="rounded-2xl bg-success/10 p-3">
				<p class="text-subtle text-[10px] font-medium uppercase tracking-wider">Pemasukan</p>
				<p class="mt-1 font-mono text-sm font-bold text-success">{formatRp(data.monthIncome)}</p>
			</div>
			<div class="rounded-2xl bg-error/10 p-3">
				<p class="text-subtle text-[10px] font-medium uppercase tracking-wider">Pengeluaran</p>
				<p class="mt-1 font-mono text-sm font-bold text-error">{formatRp(data.monthExpense)}</p>
			</div>
		</div>
	</div>

	<!-- 4. Pengeluaran (doughnut) -->
	{#if data.categoryBreakdown.length > 0}
		<div class="shadow-soft mb-4 rounded-2xl bg-base-100 p-4">
			<h2 class="heading-md text-subtle mb-2">Pengeluaran</h2>
			<div class="mx-auto" style="max-width: 180px;">
				<canvas bind:this={donutCanvas}></canvas>
			</div>
			<div class="mt-3 flex flex-col gap-1.5">
				{#each donutData as cat, i (cat.id)}
					<div class="flex items-center justify-between text-sm">
						<div class="flex items-center gap-2">
							<span
								class="inline-block size-2.5 rounded-full"
								style="background-color: {categoryColors[i]}"
							></span>
							<span class="text-sm">{cat.name}</span>
						</div>
						<span class="text-subtle font-mono text-xs">
							{formatRp(cat.total)} ({cat.percentage}%)
						</span>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- 5. Pengeluaran terbesar -->
	{#if data.categoryBreakdown.length > 0}
		<div class="mb-4">
			<h2 class="heading-md text-subtle mb-2">Pengeluaran terbesar</h2>
			<div class="flex flex-col gap-1.5">
				{#each data.categoryBreakdown.slice(0, 5) as cat, i (cat.id)}
					<div class="flex items-center gap-3 rounded-xl bg-base-200/30 p-3">
						<div
							class="flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
							style="background-color: {getCategoryColor(cat.name)}"
						>
							{i + 1}
						</div>
						<div class="min-w-0 flex-1">
							<p class="truncate text-sm font-medium">{cat.name}</p>
							<p class="text-subtle text-xs">{cat.percentage}% dari total</p>
						</div>
						<span class="font-mono text-sm font-semibold text-error">
							{formatRp(cat.total)}
						</span>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- 6. Anggaran -->
	{#if data.budgets.length > 0}
		<div class="mb-4">
			<h2 class="heading-md text-subtle mb-2">Anggaran</h2>
			<div class="flex flex-col gap-2">
				{#each data.budgets as budget (budget.name)}
					<div class="rounded-xl bg-base-200/30 p-3">
						<div class="mb-1.5 flex items-center justify-between">
							<span class="text-sm font-medium">{budget.name}</span>
							<span class="text-subtle font-mono text-xs">
								{formatRp(budget.spent)} / {formatRp(budget.limit)}
							</span>
						</div>
						<progress
							class="progress h-1.5 w-full {budgetColor(budget.spent, budget.limit)}"
							value={Math.min(budget.spent, budget.limit)}
							max={budget.limit}
						></progress>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- 7. Catatan terakhir -->
	<div class="mb-4">
		<div class="mb-2 flex items-center justify-between">
			<h2 class="heading-md text-subtle">Catatan terakhir</h2>
			<a href={resolve('/history')} class="text-xs font-medium text-primary">Lihat semua</a>
		</div>

		{#if data.recentTransactions.length === 0}
			<p class="text-subtle py-8 text-center text-sm">Belum ada transaksi. Tap + untuk menambah.</p>
		{:else}
			<div class="divide-y divide-base-200">
				{#each data.recentTransactions as tx (tx.id)}
					{@const catName = (tx.categories as unknown as { name: string })?.name ?? 'Uncategorized'}
					{@const displayName = tx.is_private && !tx.merchant ? 'Private' : tx.merchant || catName}
					<div class="flex items-center gap-3 py-3">
						<div
							class="category-icon"
							style="background-color: {getCategoryColor(catName)}"
						>
							{catName.charAt(0).toUpperCase()}
						</div>
						<div class="min-w-0 flex-1">
							<p class="truncate text-sm font-medium">{displayName}</p>
							<p class="text-subtle text-xs">
								{(tx.accounts as unknown as { name: string })?.name} · {tx.date}
							</p>
						</div>
						<span class="font-mono text-sm font-semibold {amountColor(tx.type)}">
							{formatAmount(Number(tx.amount), tx.type)}
						</span>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<!-- 8. Gamification -->
	{#if data.gamification}
		<a href={resolve('/gamification')} class="shadow-soft mb-4 block rounded-2xl bg-base-200/50 p-4 press-scale">
			<div class="flex items-center justify-between">
				<div>
					<p class="text-subtle text-xs font-medium">Points</p>
					<p class="text-xl font-bold text-primary">{data.gamification.current_points}</p>
				</div>
				<StreakIndicator days={data.gamification.streak_days} />
			</div>
		</a>
	{/if}
{:else}
	<WealthTab investments={typedInvestments} marketRates={typedMarketRates} />
{/if}
