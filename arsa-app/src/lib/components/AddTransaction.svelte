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
	<div class="modal-box max-h-[85vh]">
		<h3 class="mb-4 text-lg font-bold">Add Transaction</h3>

		{#if error}
			<div class="alert alert-error mb-4 text-sm">{error}</div>
		{/if}

		<div class="tabs tabs-boxed mb-4">
			<button class="tab" class:tab-active={type === 'out'} onclick={() => (type = 'out')}
				>Expense</button
			>
			<button class="tab" class:tab-active={type === 'in'} onclick={() => (type = 'in')}
				>Income</button
			>
			<button class="tab" class:tab-active={type === 'transfer'} onclick={() => (type = 'transfer')}
				>Transfer</button
			>
		</div>

		<div class="flex flex-col gap-3">
			{#if !isSplit}
				<input
					type="number"
					inputmode="decimal"
					placeholder="Amount"
					class="input input-bordered input-lg w-full text-center text-2xl"
					bind:value={amount}
					step="any"
				/>
			{/if}

			<select class="select select-bordered w-full" bind:value={accountId}>
				<option value="" disabled>Select account</option>
				{#each accounts as account (account.id)}
					<option value={account.id}>{account.name}</option>
				{/each}
			</select>

			{#if type === 'transfer'}
				<select class="select select-bordered w-full" bind:value={transferTo}>
					<option value="" disabled>Transfer to...</option>
					{#each accounts.filter((a) => a.id !== accountId) as account (account.id)}
						<option value={account.id}>{account.name}</option>
					{/each}
				</select>
			{/if}

			{#if type !== 'transfer' && !isSplit}
				<select class="select select-bordered w-full" bind:value={categoryId}>
					<option value="" disabled>Select category</option>
					{#each categories as category (category.id)}
						<option value={category.id}>{category.name}</option>
					{/each}
				</select>
			{/if}

			{#if type !== 'transfer'}
				<label class="label cursor-pointer justify-start gap-3">
					<input type="checkbox" class="toggle toggle-sm" bind:checked={isSplit} />
					<span class="label-text">Split across categories</span>
				</label>
			{/if}

			{#if isSplit && type !== 'transfer'}
				<div class="rounded-box flex flex-col gap-2 border border-base-300 p-3">
					{#each splitItems as item, i (i)}
						<div class="flex items-center gap-2">
							<input
								type="number"
								inputmode="decimal"
								placeholder="Amount"
								class="input input-bordered input-sm flex-1"
								bind:value={item.amount}
								step="any"
							/>
							<select class="select select-bordered select-sm flex-1" bind:value={item.categoryId}>
								<option value="" disabled>Category</option>
								{#each categories as category (category.id)}
									<option value={category.id}>{category.name}</option>
								{/each}
							</select>
							{#if splitItems.length > 1}
								<button class="btn btn-ghost btn-sm btn-square" onclick={() => removeSplitItem(i)}
									>x</button
								>
							{/if}
						</div>
					{/each}
					<button class="btn btn-ghost btn-sm" onclick={addSplitItem}>+ Add item</button>
					<p class="text-right font-mono text-sm">
						Total: Rp {splitTotal.toLocaleString('id-ID')}
					</p>
				</div>
			{/if}

			<input type="date" class="input input-bordered w-full" bind:value={date} />

			<input
				type="text"
				placeholder="Merchant (optional)"
				class="input input-bordered w-full"
				bind:value={merchant}
			/>

			<input
				type="text"
				placeholder="Notes (optional)"
				class="input input-bordered w-full"
				bind:value={notes}
			/>

			<ReceiptUpload bind:receiptKey />

			<label class="label cursor-pointer justify-start gap-3">
				<input type="checkbox" class="checkbox checkbox-sm" bind:checked={isPrivate} />
				<span class="label-text">Hide details from partner</span>
			</label>
		</div>

		<div class="modal-action">
			<button class="btn btn-ghost" onclick={onClose}>Cancel</button>
			<button class="btn btn-primary" onclick={handleSubmit} disabled={submitting}>
				{#if submitting}
					<span class="loading loading-spinner loading-sm"></span>
				{:else}
					Save
				{/if}
			</button>
		</div>
	</div>
	<button class="modal-backdrop" aria-label="Close" onclick={onClose}></button>
</div>
