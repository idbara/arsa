<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';

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

<p class="py-10 text-center text-base-content/60">Charts coming soon...</p>
