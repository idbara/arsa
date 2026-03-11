<script lang="ts">
	import { resolve } from '$app/paths';
	import { invalidateAll } from '$app/navigation';
	import { SvelteSet } from 'svelte/reactivity';
	import ReceiptViewer from '$lib/components/ReceiptViewer.svelte';
	import Reconcile from '$lib/components/Reconcile.svelte';

	let { data } = $props();

	let viewingReceipt = $state<string | null>(null);
	let showReconcile = $state(false);
	let manualMode = $state(false);
	let manualSelected = new SvelteSet<string>();
	let applyingManual = $state(false);

	const categoryColors = [
		'#6366f1', '#f43f5e', '#f59e0b', '#10b981', '#8b5cf6',
		'#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#84cc16'
	];

	function getCategoryColor(name: string): string {
		let hash = 0;
		for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
		return categoryColors[Math.abs(hash) % categoryColors.length];
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

	function toggleManualSelect(id: string) {
		if (manualSelected.has(id)) manualSelected.delete(id);
		else manualSelected.add(id);
	}

	async function applyManualReconcile() {
		applyingManual = true;
		await fetch('/api/reconcile', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ transactionIds: [...manualSelected] })
		});
		manualSelected.clear();
		manualMode = false;
		applyingManual = false;
		await invalidateAll();
	}
</script>

<div class="mb-6 flex items-center justify-between">
	<h1 class="heading-xl">History</h1>
	<div class="flex gap-2">
		<button
			class="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors {manualMode ? 'bg-primary/10 text-primary' : 'text-base-content/50'}"
			onclick={() => {
				manualMode = !manualMode;
				manualSelected.clear();
			}}
		>
			Manual
		</button>
		<button
			class="rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary"
			onclick={() => (showReconcile = true)}
		>
			Reconcile
		</button>
	</div>
</div>

{#if data.groups.length === 0}
	<p class="text-subtle py-10 text-center text-sm">No transactions yet.</p>
{:else}
	{#each data.groups as group (group.date)}
		<h3 class="text-subtle mb-2 mt-6 text-xs font-semibold uppercase tracking-wider">{group.label}</h3>
		<div class="divide-y divide-base-200">
			{#each group.transactions as tx (tx.id)}
				{@const catName = (tx.categories as unknown as { name: string })?.name ?? 'Uncategorized'}
				{@const displayName = tx.is_private && !tx.merchant ? 'Private' : tx.merchant || catName}
				<div class="flex items-center gap-3 py-3">
					{#if manualMode && !tx.is_reconciled}
						<input
							type="checkbox"
							class="checkbox checkbox-sm"
							checked={manualSelected.has(tx.id)}
							onchange={() => toggleManualSelect(tx.id)}
						/>
					{/if}
					<div
						class="category-icon"
						style="background-color: {getCategoryColor(catName)}"
					>
						{catName.charAt(0).toUpperCase()}
					</div>
					<div class="min-w-0 flex-1">
						<div class="flex items-center gap-1.5">
							<p class="truncate text-sm font-medium">{displayName}</p>
							{#if tx.is_reconciled}
								<span class="size-1.5 rounded-full bg-success"></span>
							{/if}
						</div>
						<p class="text-subtle text-xs">
							{catName} · {(tx.accounts as unknown as { name: string })?.name}
						</p>
					</div>
					<div class="flex items-center gap-2">
						{#if tx.receipt_url}
							<button
								class="rounded-lg bg-base-200/50 p-1.5"
								onclick={() => (viewingReceipt = tx.receipt_url)}
								title="View receipt"
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									class="size-4 text-base-content/40"
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
						<span class="font-mono text-sm font-semibold {amountColor(tx.type)}">
							{formatAmount(Number(tx.amount), tx.type)}
						</span>
					</div>
				</div>
			{/each}
		</div>
	{/each}

	{#if data.hasMore}
		<div class="mt-6 text-center">
			<a href="{resolve('/history')}?page={data.nextPage}" class="btn btn-ghost btn-sm rounded-lg">Load more</a>
		</div>
	{/if}
{/if}

{#if manualMode && manualSelected.size > 0}
	<div class="fixed bottom-20 left-0 right-0 flex justify-center">
		<button
			class="shadow-elevated animate-slide-up btn btn-primary rounded-full px-6 py-2.5"
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
