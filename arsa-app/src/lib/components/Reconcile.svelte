<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { parseBankCsv, type BankType } from '$lib/bank-parsers';
	import { reconcile, type ArsaTransaction, type ReconcileMatch } from '$lib/reconcile';

	let {
		arsaTransactions,
		onClose
	}: {
		arsaTransactions: ArsaTransaction[];
		onClose: () => void;
	} = $props();

	let bank = $state<BankType>('bca');
	let matches = $state<ReconcileMatch[]>([]);
	let parseError = $state('');
	let submitting = $state(false);
	let step = $state<'upload' | 'review'>('upload');

	async function handleFile(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		parseError = '';

		try {
			const bankTxs = await parseBankCsv(file, bank);
			if (bankTxs.length === 0) {
				parseError = 'No transactions found in CSV.';
				return;
			}
			matches = reconcile(bankTxs, arsaTransactions);
			step = 'review';
		} catch (e) {
			parseError = e instanceof Error ? e.message : 'Failed to parse CSV';
		}
	}

	function selectCandidate(matchIndex: number, txId: string) {
		matches[matchIndex].selectedId = txId;
		matches[matchIndex].status = 'matched';
	}

	function skipMatch(matchIndex: number) {
		matches[matchIndex].selectedId = null;
		matches[matchIndex].status = 'skipped';
	}

	let confirmedIds = $derived(
		matches.filter((m) => m.status === 'matched' && m.selectedId).map((m) => m.selectedId!)
	);

	let matchedCount = $derived(matches.filter((m) => m.status === 'matched').length);
	let unmatchedCount = $derived(matches.filter((m) => m.status === 'unmatched').length);

	async function applyReconciliation() {
		if (confirmedIds.length === 0) return;
		submitting = true;

		const res = await fetch('/api/reconcile', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ transactionIds: confirmedIds })
		});

		if (res.ok) {
			await invalidateAll();
			onClose();
		} else {
			parseError = 'Failed to apply reconciliation.';
		}

		submitting = false;
	}
</script>

<div class="modal modal-open modal-bottom">
	<div class="shadow-elevated animate-slide-up modal-box max-h-[90vh] rounded-t-3xl">
		<h3 class="heading-lg mb-4">Reconcile Transactions</h3>

		{#if parseError}
			<div class="animate-fade-in mb-4 rounded-xl bg-error/10 px-4 py-2.5 text-sm text-error">{parseError}</div>
		{/if}

		{#if step === 'upload'}
			<div class="flex flex-col gap-4">
				<label class="form-control w-full">
					<div class="label"><span class="text-sm font-medium">Bank</span></div>
					<select class="select select-bordered w-full rounded-xl" bind:value={bank}>
						<option value="bca">BCA</option>
						<option value="mandiri">Mandiri</option>
					</select>
				</label>

				<label class="form-control w-full">
					<div class="label"><span class="text-sm font-medium">CSV File</span></div>
					<input
						type="file"
						accept=".csv"
						class="file-input file-input-bordered w-full rounded-xl"
						onchange={handleFile}
					/>
				</label>

				<p class="text-subtle text-xs">
					Your CSV file is processed entirely on this device and never uploaded to any server.
				</p>
			</div>

			<div class="modal-action">
				<button class="btn btn-ghost rounded-xl" onclick={onClose}>Cancel</button>
			</div>
		{:else}
			<div class="mb-4 flex gap-3 text-sm">
				<span class="rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success">{matchedCount} matched</span>
				<span class="rounded-full bg-warning/10 px-2.5 py-0.5 text-xs font-medium text-warning">{unmatchedCount} unmatched</span>
			</div>

			<div class="flex max-h-[55vh] flex-col gap-3 overflow-y-auto">
				{#each matches as match, i (i)}
					<div class="rounded-xl bg-base-200/50 p-3">
						<div class="flex justify-between text-sm">
							<div>
								<p class="font-mono font-bold">
									Rp {Math.abs(match.bankTx.amount).toLocaleString('id-ID')}
								</p>
								<p class="text-subtle text-xs">{match.bankTx.date}</p>
								<p class="text-subtle max-w-48 truncate text-xs">
									{match.bankTx.description}
								</p>
							</div>
							<div class="text-right">
								{#if match.status === 'matched'}
									<span class="rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">Matched</span>
								{:else if match.status === 'skipped'}
									<span class="text-subtle rounded-full bg-base-200 px-2 py-0.5 text-xs font-medium">Skipped</span>
								{:else}
									<span class="rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">No match</span>
								{/if}
							</div>
						</div>

						{#if match.candidates.length > 1 && match.status !== 'skipped'}
							<div class="mt-2 flex flex-col gap-1">
								<p class="text-subtle text-xs">Multiple matches — pick one:</p>
								{#each match.candidates as candidate (candidate.id)}
									<button
										class="btn btn-xs rounded-lg"
										class:btn-primary={match.selectedId === candidate.id}
										class:btn-ghost={match.selectedId !== candidate.id}
										onclick={() => selectCandidate(i, candidate.id)}
									>
										{candidate.merchant ||
											(candidate.categories as unknown as { name: string })?.name ||
											'Unknown'}
										— {(candidate.accounts as unknown as { name: string })?.name}
									</button>
								{/each}
							</div>
						{/if}

						{#if match.status !== 'skipped' && match.candidates.length === 0}
							<p class="text-subtle mt-1 text-xs">No matching Arsa transaction found.</p>
						{/if}

						{#if match.status !== 'matched' || match.candidates.length > 1}
							<button class="btn btn-ghost btn-xs mt-1 rounded-lg" onclick={() => skipMatch(i)}>
								{match.status === 'skipped' ? 'Skipped' : 'Skip'}
							</button>
						{/if}
					</div>
				{/each}
			</div>

			<div class="modal-action">
				<button class="btn btn-ghost rounded-xl" onclick={() => (step = 'upload')}>Back</button>
				<button
					class="btn btn-primary rounded-xl"
					onclick={applyReconciliation}
					disabled={confirmedIds.length === 0 || submitting}
				>
					{#if submitting}
						<span class="loading loading-spinner loading-sm"></span>
					{:else}
						Apply ({confirmedIds.length})
					{/if}
				</button>
			</div>
		{/if}
	</div>
	<button class="modal-backdrop bg-black/30" aria-label="Close" onclick={onClose}></button>
</div>
