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
		goto(resolve(`/cashflow?month=${key}`));
	}

	function formatRp(amount: number): string {
		return `Rp ${amount.toLocaleString('id-ID')}`;
	}

	const balance = $derived(data.stats.income - data.stats.expense);
	const balanceColor = $derived(balance >= 0 ? 'text-success' : 'text-error');

	// Bar chart
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
						backgroundColor: 'rgba(0, 180, 100, 0.8)'
					},
					{
						label: 'Pengeluaran',
						data: data.trend.map((t) => t.expense),
						backgroundColor: 'rgba(240, 60, 60, 0.8)'
					}
				]
			},
			options: {
				responsive: true,
				plugins: {
					legend: { position: 'bottom' },
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
						}
					}
				}
			}
		});

		return () => {
			barChart?.destroy();
		};
	});

	// Donut chart
	const donutColors = [
		'#36a2eb', '#ff6384', '#ffce56', '#4bc0c0', '#9966ff',
		'#ff9f40', '#c9cbcf', '#7bc8a4', '#e7e9ed'
	];

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
						backgroundColor: donutColors.slice(0, data.categoryBreakdown.length)
					}
				]
			},
			options: {
				responsive: true,
				plugins: {
					legend: { display: false }
				},
				cutout: '60%'
			}
		});

		return () => {
			donutChart?.destroy();
		};
	});

	// Category drill-down
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
			resolve(`/api/cashflow/transactions?category_id=${categoryId}&month=${data.currentMonth}`)
		);
		const json = await res.json();
		categoryTransactions = json.transactions ?? [];
		loadingCategory = false;
	}
</script>

<div class="mb-6 flex items-center justify-between">
	<button class="btn btn-ghost btn-sm" onclick={() => navigateMonth(-1)}>‹</button>
	<h1 class="text-lg font-bold">{data.monthLabel}</h1>
	<button class="btn btn-ghost btn-sm" onclick={() => navigateMonth(1)}>›</button>
</div>

<div class="stats mb-6 w-full shadow">
	<div class="stat place-items-center">
		<div class="stat-title text-xs">Pemasukan</div>
		<div class="stat-value text-lg text-success">{formatRp(data.stats.income)}</div>
	</div>
	<div class="stat place-items-center">
		<div class="stat-title text-xs">Pengeluaran</div>
		<div class="stat-value text-lg text-error">{formatRp(data.stats.expense)}</div>
	</div>
	<div class="stat place-items-center">
		<div class="stat-title text-xs">Selisih</div>
		<div class="stat-value text-lg {balanceColor}">{formatRp(balance)}</div>
	</div>
</div>

<div class="mb-6">
	<h2 class="mb-3 text-sm font-bold">Tren 6 Bulan</h2>
	<div class="rounded-box bg-base-200 p-4">
		<canvas bind:this={barCanvas}></canvas>
	</div>
</div>

{#if data.categoryBreakdown.length > 0}
	<div class="mb-6">
		<h2 class="mb-3 text-sm font-bold">Pengeluaran per Kategori</h2>
		<div class="rounded-box bg-base-200 p-4">
			<div class="mx-auto max-w-[250px]">
				<canvas bind:this={donutCanvas}></canvas>
			</div>
			<div class="mt-4 flex flex-col gap-1">
				{#each data.categoryBreakdown as cat, i (cat.id)}
					<div class="flex items-center justify-between text-sm">
						<div class="flex items-center gap-2">
							<span
								class="inline-block size-3 rounded-full"
								style="background-color: {donutColors[i]}"
							></span>
							<span>{cat.name}</span>
						</div>
						<span class="font-mono text-base-content/60">
							{formatRp(cat.total)} ({cat.percentage}%)
						</span>
					</div>
				{/each}
			</div>
		</div>
	</div>

	<div class="mb-6">
		<h2 class="mb-3 text-sm font-bold">Detail per Kategori</h2>
		<div class="flex flex-col">
			{#each data.categoryBreakdown as cat, i (cat.id)}
				{#if cat.id !== '__other__'}
					<button
						class="flex w-full items-center justify-between border-b border-base-200 py-3 text-left"
						onclick={() => toggleCategory(cat.id)}
					>
						<div class="flex items-center gap-2">
							<span
								class="inline-block size-3 rounded-full"
								style="background-color: {donutColors[i]}"
							></span>
							<span class="text-sm font-medium">{cat.name}</span>
						</div>
						<div class="flex items-center gap-3">
							<span class="text-xs text-base-content/60">{cat.count}x</span>
							<span class="font-mono text-sm">{formatRp(cat.total)}</span>
							<span class="text-xs">{expandedCategory === cat.id ? '▲' : '▼'}</span>
						</div>
					</button>

					{#if expandedCategory === cat.id}
						<div class="bg-base-200 px-4 py-2">
							{#if loadingCategory}
								<div class="flex justify-center py-4">
									<span class="loading loading-spinner loading-sm"></span>
								</div>
							{:else if categoryTransactions.length === 0}
								<p class="py-2 text-center text-sm text-base-content/60">
									Tidak ada transaksi.
								</p>
							{:else}
								{#each categoryTransactions as tx (tx.id)}
									<div
										class="flex items-center justify-between border-b border-base-300 py-2 last:border-0"
									>
										<div>
											<p class="text-sm">
												{tx.is_private && !tx.merchant
													? 'Private'
													: tx.merchant || 'No merchant'}
											</p>
											<p class="text-xs text-base-content/60">{tx.date}</p>
										</div>
										<span class="font-mono text-sm text-error"
											>-{formatRp(tx.amount)}</span
										>
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
