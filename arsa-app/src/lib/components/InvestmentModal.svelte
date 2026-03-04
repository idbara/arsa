<script lang="ts">
	import { invalidateAll } from '$app/navigation';

	interface MarketRate {
		asset_code: string;
		asset_type: string;
		buy_price: number;
		sell_price: number;
	}

	interface Investment {
		asset_code: string;
		qty: number;
	}

	let {
		action,
		assetCode: propAssetCode = '',
		marketRates,
		investments,
		onClose
	}: {
		action: 'buy' | 'sell';
		assetCode?: string;
		marketRates: MarketRate[];
		investments: Investment[];
		onClose: () => void;
	} = $props();

	let assetCode = $state(propAssetCode);
	let assetType = $state('stock');
	let customTicker = $state('');
	let qty = $state('');
	let price = $state('');
	let submitting = $state(false);
	let errorMsg = $state('');
	let isCustom = $state(false);

	let selectedRate = $derived(marketRates.find((r) => r.asset_code === assetCode));

	let currentHolding = $derived(
		investments.find((i) => i.asset_code === (isCustom ? customTicker : assetCode))
	);

	let maxSellQty = $derived(currentHolding ? Number(currentHolding.qty) : 0);

	$effect(() => {
		if (selectedRate && !price) {
			price = String(selectedRate.buy_price);
		}
	});

	async function handleSubmit() {
		const finalCode = isCustom ? customTicker.toUpperCase().trim() : assetCode;
		const qtyNum = parseFloat(qty);
		const priceNum = parseFloat(price);

		if (!finalCode) {
			errorMsg = 'Select or enter an asset';
			return;
		}
		if (!qtyNum || qtyNum <= 0) {
			errorMsg = 'Enter a valid quantity';
			return;
		}
		if (!priceNum || priceNum <= 0) {
			errorMsg = 'Enter a valid price';
			return;
		}
		if (action === 'sell' && qtyNum > maxSellQty) {
			errorMsg = `Max sell quantity is ${maxSellQty}`;
			return;
		}

		submitting = true;
		errorMsg = '';

		try {
			const res = await fetch('/api/investments', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action,
					asset_code: finalCode,
					asset_type: isCustom ? assetType : (selectedRate?.asset_type ?? 'stock'),
					qty: qtyNum,
					price: priceNum
				})
			});

			if (!res.ok) {
				const data = await res.json().catch(() => ({ message: 'Request failed' }));
				errorMsg = data.message || 'Something went wrong';
				return;
			}

			await invalidateAll();
			onClose();
		} catch {
			errorMsg = 'Network error';
		} finally {
			submitting = false;
		}
	}
</script>

<div class="modal modal-open modal-bottom">
	<div class="modal-box">
		<h3 class="mb-4 text-lg font-bold">
			{action === 'buy' ? 'Buy Asset' : `Sell ${propAssetCode}`}
		</h3>

		<div class="flex flex-col gap-4">
			{#if action === 'buy'}
				<div class="form-control">
					<label class="label cursor-pointer justify-start gap-2">
						<input type="checkbox" class="checkbox checkbox-sm" bind:checked={isCustom} />
						<span class="label-text">Enter custom ticker</span>
					</label>

					{#if isCustom}
						<input
							type="text"
							class="input input-bordered w-full"
							placeholder="Ticker (e.g. UNVR)"
							bind:value={customTicker}
						/>
						<select class="select select-bordered mt-2 w-full" bind:value={assetType}>
							<option value="stock">Stock</option>
							<option value="gold">Gold</option>
						</select>
					{:else}
						<select class="select select-bordered w-full" bind:value={assetCode}>
							<option value="">Select asset...</option>
							{#each marketRates as rate (rate.asset_code)}
								<option value={rate.asset_code}>
									{rate.asset_code} ({rate.asset_type}) — Rp {rate.buy_price.toLocaleString(
										'id-ID'
									)}
								</option>
							{/each}
						</select>
					{/if}
				</div>
			{/if}

			<label class="floating-label">
				<span>Quantity {action === 'sell' ? `(max: ${maxSellQty})` : ''}</span>
				<input
					type="number"
					inputmode="decimal"
					placeholder="Quantity"
					class="input input-bordered w-full"
					bind:value={qty}
					step="any"
					min="0"
				/>
			</label>

			<label class="floating-label">
				<span>{action === 'buy' ? 'Buy' : 'Sell'} Price per Unit</span>
				<input
					type="number"
					inputmode="decimal"
					placeholder="Price per unit"
					class="input input-bordered w-full"
					bind:value={price}
					step="any"
					min="0"
				/>
			</label>

			{#if errorMsg}
				<p class="text-sm text-error">{errorMsg}</p>
			{/if}

			<div class="modal-action">
				<button type="button" class="btn btn-ghost" onclick={onClose}>Cancel</button>
				<button class="btn btn-primary" onclick={handleSubmit} disabled={submitting}>
					{#if submitting}
						<span class="loading loading-spinner loading-sm"></span>
					{:else}
						{action === 'buy' ? 'Buy' : 'Sell'}
					{/if}
				</button>
			</div>
		</div>
	</div>
	<button class="modal-backdrop" aria-label="Close" onclick={onClose}></button>
</div>
