<script lang="ts">
	import { resolve } from '$app/paths';
	import {
		Chart as ChartJS,
		CategoryScale,
		LinearScale,
		PointElement,
		LineElement,
		Filler,
		Tooltip
	} from 'chart.js';

	ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip);

	let { data } = $props();

	function formatRp(amount: number): string {
		return `Rp ${amount.toLocaleString('id-ID')}`;
	}

	const hasData = $derived(
		data.historicalMonths.some((m) => m.income > 0 || m.expense > 0)
	);

	// Chart: current month label + 3 forecast months
	const chartLabels = $derived(() => {
		const now = new Date();
		const current = now.toLocaleDateString('id-ID', { month: 'short' });
		return [current, ...data.forecast.map((f) => f.label)];
	});

	const chartData = $derived(() => {
		return [data.currentBalance, ...data.forecast.map((f) => f.balance)];
	});

	let lineCanvas = $state<HTMLCanvasElement | null>(null);
	let lineChart = $state<ChartJS | null>(null);

	$effect(() => {
		if (!lineCanvas || !hasData) return;
		lineChart?.destroy();
		const labels = chartLabels();
		const values = chartData();

		lineChart = new ChartJS(lineCanvas, {
			type: 'line',
			data: {
				labels,
				datasets: [
					{
						data: values,
						borderColor: '#6366f1',
						backgroundColor: 'rgba(99,102,241,0.08)',
						fill: true,
						tension: 0.3,
						pointRadius: 4,
						pointBackgroundColor: '#6366f1',
						segment: {
							borderDash: (ctx) => (ctx.p0DataIndex >= 0 && ctx.p1DataIndex >= 1 ? [5, 5] : [])
						}
					}
				]
			},
			options: {
				responsive: true,
				plugins: {
					legend: { display: false },
					tooltip: {
						callbacks: {
							label: (ctx) => `Rp ${Number(ctx.raw).toLocaleString('id-ID')}`
						}
					}
				},
				scales: {
					y: { display: false },
					x: { grid: { display: false } }
				}
			}
		});

		return () => {
			lineChart?.destroy();
		};
	});
</script>

<!-- Header -->
<div class="mb-5 flex items-center gap-3">
	<a
		href={resolve('/plan')}
		class="flex size-8 items-center justify-center rounded-full bg-base-200 press-scale"
	>
		<span class="text-sm">&#8249;</span>
	</a>
	<div>
		<h1 class="heading-lg">Proyeksi Keuangan</h1>
		<p class="text-subtle text-xs">Rata-rata 3 bulan terakhir</p>
	</div>
</div>

{#if !hasData}
	<div class="flex flex-col items-center justify-center py-16 text-center">
		<div class="mb-4 text-4xl opacity-30">📊</div>
		<p class="text-subtle text-sm">Belum ada data transaksi untuk membuat proyeksi.</p>
		<a href={resolve('/')} class="btn btn-primary btn-sm mt-4">Tambah Transaksi</a>
	</div>
{:else}
	<!-- Summary cards -->
	<div class="mb-5 grid grid-cols-2 gap-3">
		<div class="rounded-2xl bg-success/10 p-4">
			<p class="text-subtle text-[10px] font-medium uppercase tracking-wider">Est. Pemasukan</p>
			<p class="mt-1 font-mono text-lg font-bold text-success">{formatRp(data.avgIncome)}</p>
			<p class="text-subtle text-[10px]">per bulan</p>
		</div>
		<div class="rounded-2xl bg-error/10 p-4">
			<p class="text-subtle text-[10px] font-medium uppercase tracking-wider">Est. Pengeluaran</p>
			<p class="mt-1 font-mono text-lg font-bold text-error">{formatRp(data.avgExpense)}</p>
			<p class="text-subtle text-[10px]">per bulan</p>
		</div>
	</div>

	<!-- Balance projection chart -->
	<div class="mb-5">
		<h2 class="heading-md text-subtle mb-3">Proyeksi Saldo</h2>
		<div class="shadow-soft rounded-2xl bg-base-100 p-4">
			<canvas bind:this={lineCanvas} style="height: 160px"></canvas>
		</div>
	</div>

	<!-- Monthly breakdown -->
	<div class="mb-5">
		<h2 class="heading-md text-subtle mb-3">Rincian Bulanan</h2>
		<div class="shadow-soft flex flex-col divide-y divide-base-200/50 rounded-2xl bg-base-100">
			{#each data.forecast as month (month.month)}
				<div class="flex items-center justify-between p-4">
					<span class="text-sm font-medium">{month.label}</span>
					<div class="flex items-center gap-4 text-xs">
						<span class="font-mono text-success">+{formatRp(month.income)}</span>
						<span class="font-mono text-error">-{formatRp(month.expense)}</span>
						<span class="font-mono font-semibold {month.net >= 0 ? 'text-success' : 'text-error'}">
							{month.net >= 0 ? '+' : ''}{formatRp(month.net)}
						</span>
					</div>
				</div>
			{/each}
		</div>
	</div>

	<!-- Subscription impact -->
	{#if data.subscriptionMonthly > 0}
		<div class="mb-5 flex items-center gap-3 rounded-2xl border border-primary/10 bg-primary/5 p-4">
			<div class="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-base">
				🔄
			</div>
			<div>
				<p class="text-sm font-medium">Langganan tetap</p>
				<p class="text-subtle text-xs">
					<span class="font-mono">{formatRp(data.subscriptionMonthly)}</span>/bulan termasuk dalam proyeksi
				</p>
			</div>
		</div>
	{/if}

	<!-- Category forecast -->
	{#if data.categoryForecast.length > 0}
		<div class="mb-5">
			<h2 class="heading-md text-subtle mb-3">Proyeksi per Kategori</h2>
			<div class="flex flex-col gap-2">
				{#each data.categoryForecast as cat (cat.name)}
					<div class="rounded-xl bg-base-200/30 p-3">
						<div class="flex items-center justify-between">
							<span class="text-sm font-medium">{cat.name}</span>
							<span class="font-mono text-sm {cat.overBudget ? 'text-error' : ''}">
								{formatRp(cat.avg)}
							</span>
						</div>
						{#if cat.budget !== null}
							{@const pct = Math.min(Math.round((cat.avg / cat.budget) * 100), 100)}
							<div class="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-base-300">
								<div
									class="h-full rounded-full transition-all {cat.overBudget ? 'bg-error' : 'bg-primary'}"
									style="width: {pct}%"
								></div>
							</div>
							<div class="mt-1 flex justify-between text-[10px]">
								<span class="text-subtle">Budget: {formatRp(cat.budget)}</span>
								{#if cat.overBudget}
									<span class="text-error font-semibold">
										+{Math.round(((cat.avg - cat.budget) / cat.budget) * 100)}% over
									</span>
								{:else}
									<span class="text-subtle">{pct}%</span>
								{/if}
							</div>
						{/if}
					</div>
				{/each}
			</div>
		</div>
	{/if}
{/if}
