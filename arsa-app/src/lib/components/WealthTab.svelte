<script lang="ts">
	import InvestmentModal from './InvestmentModal.svelte';

	interface Investment {
		id: string;
		asset_code: string;
		qty: number;
		avg_buy_price: number;
		market_rates: {
			asset_code: string;
			asset_type: string;
			buy_price: number;
			sell_price: number;
			updated_at: string;
		} | null;
	}

	interface MarketRate {
		asset_code: string;
		asset_type: string;
		buy_price: number;
		sell_price: number;
		updated_at: string;
	}

	let {
		investments,
		marketRates
	}: {
		investments: Investment[];
		marketRates: MarketRate[];
	} = $props();

	let showModal = $state(false);
	let modalAction = $state<'buy' | 'sell'>('buy');
	let selectedAsset = $state('');

	let holdings = $derived(
		investments.map((inv) => {
			const rate = inv.market_rates;
			const currentPrice = rate?.sell_price ?? 0;
			const currentValue = inv.qty * currentPrice;
			const costBasis = inv.qty * inv.avg_buy_price;
			const pl = currentValue - costBasis;
			const plPercent = costBasis > 0 ? (pl / costBasis) * 100 : 0;

			return {
				...inv,
				currentPrice,
				currentValue,
				pl,
				plPercent,
				assetType: rate?.asset_type ?? 'unknown',
				updatedAt: rate?.updated_at ?? ''
			};
		})
	);

	let totalValue = $derived(holdings.reduce((sum, h) => sum + h.currentValue, 0));
	let totalPl = $derived(holdings.reduce((sum, h) => sum + h.pl, 0));
	let totalCost = $derived(holdings.reduce((sum, h) => sum + h.qty * h.avg_buy_price, 0));
	let totalPlPercent = $derived(totalCost > 0 ? (totalPl / totalCost) * 100 : 0);

	function openBuy() {
		modalAction = 'buy';
		selectedAsset = '';
		showModal = true;
	}

	function openSell(assetCode: string) {
		modalAction = 'sell';
		selectedAsset = assetCode;
		showModal = true;
	}

	function formatRp(n: number): string {
		return 'Rp ' + Math.round(n).toLocaleString('id-ID');
	}

	function formatDate(iso: string): string {
		if (!iso) return '-';
		return new Date(iso).toLocaleDateString('id-ID', {
			day: 'numeric',
			month: 'short',
			hour: '2-digit',
			minute: '2-digit'
		});
	}
</script>

<div class="stats stats-vertical mb-4 w-full shadow">
	<div class="stat">
		<div class="stat-title">Total Portfolio Value</div>
		<div class="stat-value text-2xl text-primary">{formatRp(totalValue)}</div>
	</div>
	<div class="stat">
		<div class="stat-title">Floating P/L</div>
		<div
			class="stat-value text-2xl"
			class:text-success={totalPl >= 0}
			class:text-error={totalPl < 0}
		>
			{totalPl >= 0 ? '+' : ''}{formatRp(totalPl)}
			<span class="text-base font-normal">
				({totalPl >= 0 ? '+' : ''}{totalPlPercent.toFixed(1)}%)
			</span>
		</div>
	</div>
</div>

<button class="btn btn-primary mb-4 w-full" onclick={openBuy}>+ Buy Asset</button>

{#if holdings.length === 0}
	<div class="py-8 text-center text-base-content/60">
		<p>No investments yet.</p>
		<p class="text-sm">Tap "Buy Asset" to add your first holding.</p>
	</div>
{:else}
	<div class="flex flex-col gap-3">
		{#each holdings as h (h.id)}
			<div class="card bg-base-200 shadow-sm">
				<div class="card-body p-4">
					<div class="flex items-center justify-between">
						<div>
							<span class="text-lg font-bold">{h.asset_code}</span>
							<span class="badge badge-ghost badge-sm ml-2">{h.assetType}</span>
						</div>
						<button class="btn btn-ghost btn-sm text-error" onclick={() => openSell(h.asset_code)}>
							Sell
						</button>
					</div>

					<div class="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
						<span class="text-base-content/60">Qty</span>
						<span class="text-right font-mono">{h.qty}</span>

						<span class="text-base-content/60">Avg Buy</span>
						<span class="text-right font-mono">{formatRp(h.avg_buy_price)}</span>

						<span class="text-base-content/60">Current</span>
						<span class="text-right font-mono">{formatRp(h.currentPrice)}</span>

						<span class="text-base-content/60">Value</span>
						<span class="text-right font-mono font-bold">{formatRp(h.currentValue)}</span>

						<span class="text-base-content/60">P/L</span>
						<span
							class="text-right font-mono"
							class:text-success={h.pl >= 0}
							class:text-error={h.pl < 0}
						>
							{h.pl >= 0 ? '+' : ''}{formatRp(h.pl)} ({h.pl >= 0 ? '+' : ''}{h.plPercent.toFixed(
								1
							)}%)
						</span>
					</div>

					<div class="mt-1 text-xs text-base-content/40">
						Updated: {formatDate(h.updatedAt)}
					</div>
				</div>
			</div>
		{/each}
	</div>
{/if}

{#if showModal}
	<InvestmentModal
		action={modalAction}
		assetCode={selectedAsset}
		{marketRates}
		{investments}
		onClose={() => (showModal = false)}
	/>
{/if}
