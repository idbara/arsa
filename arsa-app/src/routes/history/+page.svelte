<script lang="ts">
	import { resolve } from '$app/paths';
	import { invalidateAll } from '$app/navigation';
	import ReceiptViewer from '$lib/components/ReceiptViewer.svelte';
	import Reconcile from '$lib/components/Reconcile.svelte';

	let { data } = $props();

	let viewingReceipt = $state<string | null>(null);
	let showReconcile = $state(false);
	let manualMode = $state(false);
	let manualSelected = $state<Set<string>>(new Set());
	let applyingManual = $state(false);

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

	function toggleManualSelect(id: string) {
		const next = new Set(manualSelected);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		manualSelected = next;
	}

	async function applyManualReconcile() {
		applyingManual = true;
		await fetch('/api/reconcile', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ transactionIds: [...manualSelected] })
		});
		manualSelected = new Set();
		manualMode = false;
		applyingManual = false;
		await invalidateAll();
	}
</script>

<div class="mb-6 flex items-center justify-between">
	<h1 class="text-2xl font-bold">History</h1>
	<div class="flex gap-2">
		<button
			class="btn btn-ghost btn-sm"
			class:btn-active={manualMode}
			onclick={() => {
				manualMode = !manualMode;
				manualSelected = new Set();
			}}
		>
			Manual
		</button>
		<button class="btn btn-secondary btn-sm" onclick={() => (showReconcile = true)}
			>Reconcile</button
		>
	</div>
</div>

{#if data.groups.length === 0}
	<p class="py-10 text-center text-base-content/60">No transactions yet.</p>
{:else}
	{#each data.groups as group (group.date)}
		<h3 class="mb-2 mt-4 text-sm font-semibold text-base-content/60">{group.label}</h3>
		<div class="flex flex-col gap-1">
			{#each group.transactions as tx (tx.id)}
				<div class="flex items-center justify-between border-b border-base-200 py-3">
					<div class="flex items-center gap-2">
						{#if manualMode && !tx.is_reconciled}
							<input
								type="checkbox"
								class="checkbox checkbox-sm"
								checked={manualSelected.has(tx.id)}
								onchange={() => toggleManualSelect(tx.id)}
							/>
						{/if}
						<div>
							<div class="flex items-center gap-1">
								<p class="text-sm font-medium">
									{tx.is_private && !tx.merchant
										? 'Private'
										: tx.merchant ||
											(tx.categories as unknown as { name: string })?.name ||
											'Uncategorized'}
								</p>
								{#if tx.is_reconciled}
									<span class="badge badge-success badge-xs">✓</span>
								{/if}
							</div>
							<p class="text-xs text-base-content/60">
								{(tx.categories as unknown as { name: string })?.name ?? ''}
								· {(tx.accounts as unknown as { name: string })?.name}
							</p>
						</div>
					</div>
					<div class="flex items-center gap-2">
						{#if tx.receipt_url}
							<button
								class="btn btn-ghost btn-square btn-xs"
								onclick={() => (viewingReceipt = tx.receipt_url)}
								title="View receipt"
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									class="size-4"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M4 16l4.586-4.586a2 2 0 0 1 2.828 0L16 16m-2-2 1.586-1.586a2 2 0 0 1 2.828 0L20 14m-6-6h.01M6 20h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z"
									/>
								</svg>
							</button>
						{/if}
						<span class="font-mono text-sm font-bold {amountColor(tx.type)}">
							{formatAmount(Number(tx.amount), tx.type)}
						</span>
					</div>
				</div>
			{/each}
		</div>
	{/each}

	{#if data.hasMore}
		<div class="mt-6 text-center">
			<a href={resolve(`/history?page=${data.nextPage}`)} class="btn btn-ghost btn-sm">Load more</a>
		</div>
	{/if}
{/if}

{#if manualMode && manualSelected.size > 0}
	<div class="fixed bottom-20 left-0 right-0 flex justify-center">
		<button
			class="btn btn-primary btn-sm shadow-lg"
			disabled={applyingManual}
			onclick={applyManualReconcile}
		>
			{#if applyingManual}
				<span class="loading loading-spinner loading-sm"></span>
			{:else}
				Mark {manualSelected.size} as reconciled
			{/if}
		</button>
	</div>
{/if}

{#if viewingReceipt}
	<ReceiptViewer receiptUrl={viewingReceipt} onClose={() => (viewingReceipt = null)} />
{/if}

{#if showReconcile}
	<Reconcile arsaTransactions={data.reconCandidates} onClose={() => (showReconcile = false)} />
{/if}
