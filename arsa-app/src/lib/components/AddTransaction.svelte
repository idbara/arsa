<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import ReceiptUpload from '$lib/components/ReceiptUpload.svelte';

	let {
		accounts,
		categories,
		onClose
	}: {
		accounts: { id: string; name: string; type: string }[];
		categories: { id: string; name: string }[];
		onClose: () => void;
	} = $props();

	let type = $state<'out' | 'in' | 'transfer'>('out');
	let accountId = $state('');
	let transferTo = $state('');
	let date = $state(new Date().toISOString().split('T')[0]);
	let merchant = $state('');
	let notes = $state('');
	let isPrivate = $state(false);
	let isSplit = $state(false);
	let receiptKey = $state('');
	let submitting = $state(false);
	let scanning = $state(false);
	let scanError = $state('');
	let error = $state('');

	let amount = $state('');
	let categoryId = $state('');

	let splitItems = $state([{ amount: '', categoryId: '' }]);

	function addSplitItem() {
		splitItems = [...splitItems, { amount: '', categoryId: '' }];
	}

	function removeSplitItem(index: number) {
		splitItems = splitItems.filter((_, i) => i !== index);
	}

	let splitTotal = $derived(
		splitItems.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0)
	);

	async function scanReceipt() {
		if (!receiptKey) return;
		scanning = true;
		scanError = '';

		try {
			const res = await fetch('/api/ocr', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ key: receiptKey })
			});

			const data = await res.json();

			if (!data.success) {
				scanError = data.error || 'Could not read receipt.';
				return;
			}

			if (data.data.nominal != null) {
				amount = String(data.data.nominal);
			}
			if (data.data.tanggal) {
				date = data.data.tanggal;
			}
			if (data.data.merchant) {
				merchant = data.data.merchant;
			}
		} catch {
			scanError = 'Failed to scan receipt.';
		} finally {
			scanning = false;
		}
	}

	async function handleSubmit() {
		error = '';
		submitting = true;

		let items: { amount: number; category_id: string | null }[];

		if (isSplit) {
			if (splitItems.some((item) => !item.amount || (!item.categoryId && type !== 'transfer'))) {
				error = 'All split items need an amount and category.';
				submitting = false;
				return;
			}
			items = splitItems.map((item) => ({
				amount: parseFloat(item.amount),
				category_id: type === 'transfer' ? null : item.categoryId
			}));
		} else {
			if (!amount || (!categoryId && type !== 'transfer')) {
				error = 'Amount and category are required.';
				submitting = false;
				return;
			}
			items = [
				{ amount: parseFloat(amount), category_id: type === 'transfer' ? null : categoryId }
			];
		}

		if (!accountId) {
			error = 'Please select an account.';
			submitting = false;
			return;
		}

		const res = await fetch('/api/transactions', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				type,
				account_id: accountId,
				transfer_to: type === 'transfer' ? transferTo : null,
				date,
				merchant,
				notes,
				is_private: isPrivate,
				receipt_url: receiptKey || null,
				items
			})
		});

		if (!res.ok) {
			const data = await res.json();
			error = data.error || 'Something went wrong.';
			submitting = false;
			return;
		}

		await invalidateAll();
		receiptKey = '';
		submitting = false;
		onClose();
	}
</script>

<div class="modal modal-open modal-bottom">
	<div class="shadow-elevated animate-slide-up modal-box max-h-[85vh] rounded-t-3xl">
		<h3 class="heading-lg mb-4">Add Transaction</h3>

		{#if error}
			<div class="animate-fade-in mb-4 rounded-xl bg-error/10 px-4 py-2.5 text-sm text-error">{error}</div>
		{/if}

		<!-- Type tabs — pill switcher -->
		<div class="mb-4 rounded-xl bg-base-200/50 p-1">
			<div class="flex">
				<button
					class="flex-1 rounded-lg py-2 text-sm transition-all {type === 'out' ? 'shadow-soft bg-base-100 font-medium' : 'text-base-content/50'}"
					onclick={() => (type = 'out')}
				>Expense</button>
				<button
					class="flex-1 rounded-lg py-2 text-sm transition-all {type === 'in' ? 'shadow-soft bg-base-100 font-medium' : 'text-base-content/50'}"
					onclick={() => (type = 'in')}
				>Income</button>
				<button
					class="flex-1 rounded-lg py-2 text-sm transition-all {type === 'transfer' ? 'shadow-soft bg-base-100 font-medium' : 'text-base-content/50'}"
					onclick={() => (type = 'transfer')}
				>Transfer</button>
			</div>
		</div>

		<div class="flex flex-col gap-3">
			{#if !isSplit}
				<input
					type="number"
					inputmode="decimal"
					placeholder="0"
					class="w-full rounded-2xl bg-base-200/30 py-4 text-center font-mono text-3xl font-bold focus:outline-none focus:ring-2 focus:ring-primary/30"
					bind:value={amount}
					step="any"
				/>
			{/if}

			<select class="select select-bordered w-full rounded-xl" bind:value={accountId}>
				<option value="" disabled>Select account</option>
				{#each accounts as account (account.id)}
					<option value={account.id}>{account.name}</option>
				{/each}
			</select>

			{#if type === 'transfer'}
				<select class="select select-bordered w-full rounded-xl" bind:value={transferTo}>
					<option value="" disabled>Transfer to...</option>
					{#each accounts.filter((a) => a.id !== accountId) as account (account.id)}
						<option value={account.id}>{account.name}</option>
					{/each}
				</select>
			{/if}

			{#if type !== 'transfer' && !isSplit}
				<select class="select select-bordered w-full rounded-xl" bind:value={categoryId}>
					<option value="" disabled>Select category</option>
					{#each categories as category (category.id)}
						<option value={category.id}>{category.name}</option>
					{/each}
				</select>
			{/if}

			{#if type !== 'transfer'}
				<label class="label cursor-pointer justify-start gap-3">
					<input type="checkbox" class="toggle toggle-sm" bind:checked={isSplit} />
					<span class="text-sm">Split across categories</span>
				</label>
			{/if}

			{#if isSplit && type !== 'transfer'}
				<div class="flex flex-col gap-2 rounded-xl border border-base-200 p-3">
					{#each splitItems as item, i (i)}
						<div class="flex items-center gap-2">
							<input
								type="number"
								inputmode="decimal"
								placeholder="Amount"
								class="input input-bordered input-sm flex-1 rounded-lg"
								bind:value={item.amount}
								step="any"
							/>
							<select class="select select-bordered select-sm flex-1 rounded-lg" bind:value={item.categoryId}>
								<option value="" disabled>Category</option>
								{#each categories as category (category.id)}
									<option value={category.id}>{category.name}</option>
								{/each}
							</select>
							{#if splitItems.length > 1}
								<button class="btn btn-ghost btn-sm btn-square rounded-lg" onclick={() => removeSplitItem(i)}>x</button>
							{/if}
						</div>
					{/each}
					<button class="btn btn-ghost btn-sm rounded-lg" onclick={addSplitItem}>+ Add item</button>
					<p class="text-right font-mono text-sm">
						Total: Rp {splitTotal.toLocaleString('id-ID')}
					</p>
				</div>
			{/if}

			<input type="date" class="input input-bordered w-full rounded-xl" bind:value={date} />

			<input
				type="text"
				placeholder="Merchant (optional)"
				class="input input-bordered w-full rounded-xl"
				bind:value={merchant}
			/>

			<input
				type="text"
				placeholder="Notes (optional)"
				class="input input-bordered w-full rounded-xl"
				bind:value={notes}
			/>

			<ReceiptUpload bind:receiptKey />

			{#if receiptKey && !isSplit}
				<button
					type="button"
					class="btn btn-secondary btn-sm w-full rounded-xl"
					onclick={scanReceipt}
					disabled={scanning}
				>
					{#if scanning}
						<span class="loading loading-spinner loading-sm"></span>
						Scanning...
					{:else}
						Scan Receipt
					{/if}
				</button>
				{#if scanError}
					<p class="text-xs text-warning">{scanError}</p>
				{/if}
			{/if}

			<label class="label cursor-pointer justify-start gap-3">
				<input type="checkbox" class="checkbox checkbox-sm" bind:checked={isPrivate} />
				<span class="text-sm">Hide details from partner</span>
			</label>
		</div>

		<div class="modal-action">
			<button class="btn btn-ghost rounded-xl" onclick={onClose}>Cancel</button>
			<button class="btn btn-primary rounded-xl" onclick={handleSubmit} disabled={submitting}>
				{#if submitting}
					<span class="loading loading-spinner loading-sm"></span>
				{:else}
					Save
				{/if}
			</button>
		</div>
	</div>
	<button class="modal-backdrop bg-black/30" aria-label="Close" onclick={onClose}></button>
</div>
