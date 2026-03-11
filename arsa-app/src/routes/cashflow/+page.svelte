<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import {
		Chart as ChartJS,
		CategoryScale,
		LinearScale,
		BarElement,
		ArcElement,
		Title,
		Tooltip,
		Legend
	} from 'chart.js';

	ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

	let { data } = $props();

	function navigateMonth(delta: number) {
		const [y, m] = data.currentMonth.split('-').map(Number);
		const d = new Date(y, m - 1 + delta, 1);
		const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- resolve() used for base path, query params appended separately
		goto(`${resolve('/cashflow')}?month=${key}`);
	}

	function formatRp(amount: number): string {
		return `Rp ${amount.toLocaleString('id-ID')}`;
	}

	const balance = $derived(data.stats.income - data.stats.expense);
	const balanceColor = $derived(balance >= 0 ? 'text-success' : 'text-error');

	const donutColors = [
		'#6366f1', '#f43f5e', '#f59e0b', '#10b981', '#8b5cf6',
		'#ec4899', '#14b8a6', '#f97316', '#06b6d4'
	];

	let barCanvas = $state<HTMLCanvasElement | null>(null);
	let barChart = $state<ChartJS | null>(null);

	$effect(() => {
		if (!barCanvas) return;
		barChart?.destroy();
		barChart = new ChartJS(barCanvas, {
			type: 'bar',
			data: {
				labels: data.trend.map((t) => t.label),
				datasets: [
					{
						label: 'Pemasukan',
						data: data.trend.map((t) => t.income),
						backgroundColor: 'rgba(16, 185, 129, 0.8)',
						borderRadius: 4
					},
					{
						label: 'Pengeluaran',
						data: data.trend.map((t) => t.expense),
						backgroundColor: 'rgba(244, 63, 94, 0.8)',
						borderRadius: 4
					}
				]
			},
			options: {
				responsive: true,
				plugins: {
					legend: { position: 'bottom', labels: { boxWidth: 12, padding: 16 } },
					title: { display: false }
				},
				scales: {
					y: {
						ticks: {
							callback: (value) => {
								const v = Number(value);
								if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(0)}jt`;
								if (v >= 1_000) return `${(v / 1_000).toFixed(0)}rb`;
								return String(v);
							}
						},
						grid: { color: 'rgba(0,0,0,0.04)' }
					},
					x: { grid: { display: false } }
				}
			}
		});

		return () => {
			barChart?.destroy();
		};
	});

	let donutCanvas = $state<HTMLCanvasElement | null>(null);
	let donutChart = $state<ChartJS | null>(null);

	$effect(() => {
		if (!donutCanvas || data.categoryBreakdown.length === 0) return;
		donutChart?.destroy();
		donutChart = new ChartJS(donutCanvas, {
			type: 'doughnut',
			data: {
				labels: data.categoryBreakdown.map((c) => c.name),
				datasets: [
					{
						data: data.categoryBreakdown.map((c) => c.total),
						backgroundColor: donutColors.slice(0, data.categoryBreakdown.length),
						borderWidth: 0
					}
				]
			},
			options: {
				responsive: true,
				plugins: {
					legend: { display: false }
				},
				cutout: '65%'
			}
		});

		return () => {
			donutChart?.destroy();
		};
	});

	let expandedCategory = $state<string | null>(null);
	let categoryTransactions = $state<
		Array<{
			id: string;
			date: string;
			merchant: string | null;
			amount: number;
			is_private: boolean;
		}>
	>([]);
	let loadingCategory = $state(false);

	async function toggleCategory(categoryId: string) {
		if (expandedCategory === categoryId) {
			expandedCategory = null;
			return;
		}

		expandedCategory = categoryId;
		loadingCategory = true;

		const res = await fetch(
			`${resolve('/api/cashflow/transactions')}?category_id=${categoryId}&month=${data.currentMonth}`
		);
		const json = await res.json();
		categoryTransactions = json.transactions ?? [];
		loadingCategory = false;
	}
</script>

<!-- Month navigation -->
<div class="mb-6 flex items-center justify-between">
	<button class="flex size-8 items-center justify-center rounded-full bg-base-200 press-scale active:bg-base-300" onclick={() => navigateMonth(-1)}>
		<span class="text-sm">&#8249;</span>
	</button>
	<h1 class="heading-lg">{data.monthLabel}</h1>
	<button class="flex size-8 items-center justify-center rounded-full bg-base-200 press-scale active:bg-base-300" onclick={() => navigateMonth(1)}>
		<span class="text-sm">&#8250;</span>
	</button>
</div>

<!-- Stats cards -->
<div class="mb-6 grid grid-cols-3 gap-2">
	<div class="rounded-2xl bg-base-200/30 p-3 text-center">
		<p class="text-subtle text-[10px] font-medium uppercase tracking-wider">Pemasukan</p>
		<p class="mt-1 font-mono text-sm font-bold text-success">{formatRp(data.stats.income)}</p>
	</div>
	<div class="rounded-2xl bg-base-200/30 p-3 text-center">
		<p class="text-subtle text-[10px] font-medium uppercase tracking-wider">Pengeluaran</p>
		<p class="mt-1 font-mono text-sm font-bold text-error">{formatRp(data.stats.expense)}</p>
	</div>
	<div class="rounded-2xl bg-base-200/30 p-3 text-center">
		<p class="text-subtle text-[10px] font-medium uppercase tracking-wider">Selisih</p>
		<p class="mt-1 font-mono text-sm font-bold {balanceColor}">{formatRp(balance)}</p>
	</div>
</div>

<!-- Trend chart -->
<div class="mb-6">
	<h2 class="heading-md text-subtle mb-3">Tren 6 Bulan</h2>
	<div class="shadow-soft rounded-2xl bg-base-100 p-4">
		<canvas bind:this={barCanvas}></canvas>
	</div>
</div>

<!-- Category breakdown -->
{#if data.categoryBreakdown.length > 0}
	<div class="mb-6">
		<h2 class="heading-md text-subtle mb-3">Pengeluaran per Kategori</h2>
		<div class="shadow-soft rounded-2xl bg-base-100 p-4">
			<div class="mx-auto max-w-[220px]">
				<canvas bind:this={donutCanvas}></canvas>
			</div>
			<div class="mt-4 flex flex-col gap-1.5">
				{#each data.categoryBreakdown as cat, i (cat.id)}
					<div class="flex items-center justify-between text-sm">
						<div class="flex items-center gap-2">
							<span
								class="inline-block size-2.5 rounded-full"
								style="background-color: {donutColors[i]}"
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
	</div>

	<!-- Category drill-down -->
	<div class="mb-6">
		<h2 class="heading-md text-subtle mb-3">Detail per Kategori</h2>
		<div class="flex flex-col">
			{#each data.categoryBreakdown as cat, i (cat.id)}
				{#if cat.id !== '__other__'}
					<button
						class="flex w-full items-center justify-between rounded-xl py-3 text-left press-scale"
						onclick={() => toggleCategory(cat.id)}
					>
						<div class="flex items-center gap-2">
							<span
								class="inline-block size-2.5 rounded-full"
								style="background-color: {donutColors[i]}"
							></span>
							<span class="text-sm font-medium">{cat.name}</span>
						</div>
						<div class="flex items-center gap-3">
							<span class="text-subtle text-xs">{cat.count}x</span>
							<span class="font-mono text-sm">{formatRp(cat.total)}</span>
							<span class="text-base-content/30 text-xs">{expandedCategory === cat.id ? '▲' : '▼'}</span>
						</div>
					</button>

					{#if expandedCategory === cat.id}
						<div class="animate-slide-down mb-2 rounded-lg bg-base-200/20 px-4 py-2">
							{#if loadingCategory}
								<div class="flex justify-center py-4">
									<span class="loading loading-spinner loading-sm"></span>
								</div>
							{:else if categoryTransactions.length === 0}
								<p class="text-subtle py-2 text-center text-sm">Tidak ada transaksi.</p>
							{:else}
								{#each categoryTransactions as tx (tx.id)}
									<div
										class="flex items-center justify-between border-b border-base-200/50 py-2 last:border-0"
									>
										<div>
											<p class="text-sm">
												{tx.is_private && !tx.merchant ? 'Private' : tx.merchant || 'No merchant'}
											</p>
											<p class="text-subtle text-xs">{tx.date}</p>
										</div>
										<span class="font-mono text-sm text-error">-{formatRp(tx.amount)}</span>
									</div>
								{/each}
							{/if}
						</div>
					{/if}
				{/if}
			{/each}
		</div>
	</div>
{/if}
