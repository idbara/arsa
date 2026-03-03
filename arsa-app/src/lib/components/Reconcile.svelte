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
	<div class="modal-box max-h-[90vh]">
		<h3 class="mb-4 text-lg font-bold">Reconcile Transactions</h3>

		{#if parseError}
			<div class="alert alert-error mb-4 text-sm">{parseError}</div>
		{/if}

		{#if step === 'upload'}
			<div class="flex flex-col gap-4">
				<label class="form-control w-full">
					<div class="label"><span class="label-text">Bank</span></div>
					<select class="select select-bordered w-full" bind:value={bank}>
						<option value="bca">BCA</option>
						<option value="mandiri">Mandiri</option>
					</select>
				</label>

				<label class="form-control w-full">
					<div class="label"><span class="label-text">CSV File</span></div>
					<input
						type="file"
						accept=".csv"
						class="file-input file-input-bordered w-full"
						onchange={handleFile}
					/>
				</label>

				<p class="text-xs text-base-content/60">
					Your CSV file is processed entirely on this device and never uploaded to any server.
				</p>
			</div>

			<div class="modal-action">
				<button class="btn btn-ghost" onclick={onClose}>Cancel</button>
			</div>
		{:else}
			<div class="mb-4 flex gap-3 text-sm">
				<span class="badge badge-success">{matchedCount} matched</span>
				<span class="badge badge-warning">{unmatchedCount} unmatched</span>
			</div>

			<div class="flex max-h-[55vh] flex-col gap-3 overflow-y-auto">
				{#each matches as match, i (i)}
					<div class="card bg-base-200 p-3">
						<div class="flex justify-between text-sm">
							<div>
								<p class="font-mono font-bold">
									Rp {Math.abs(match.bankTx.amount).toLocaleString('id-ID')}
								</p>
								<p class="text-xs text-base-content/60">{match.bankTx.date}</p>
								<p class="max-w-48 truncate text-xs text-base-content/60">
									{match.bankTx.description}
								</p>
							</div>
							<div class="text-right">
								{#if match.status === 'matched'}
									<span class="badge badge-success badge-sm">Matched</span>
								{:else if match.status === 'skipped'}
									<span class="badge badge-ghost badge-sm">Skipped</span>
								{:else}
									<span class="badge badge-warning badge-sm">No match</span>
								{/if}
							</div>
						</div>

						{#if match.candidates.length > 1 && match.status !== 'skipped'}
							<div class="mt-2 flex flex-col gap-1">
								<p class="text-xs text-base-content/60">Multiple matches — pick one:</p>
								{#each match.candidates as candidate (candidate.id)}
									<button
										class="btn btn-xs"
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
							<p class="mt-1 text-xs text-base-content/60">No matching Arsa transaction found.</p>
						{/if}

						{#if match.status !== 'matched' || match.candidates.length > 1}
							<button class="btn btn-ghost btn-xs mt-1" onclick={() => skipMatch(i)}>
								{match.status === 'skipped' ? 'Skipped' : 'Skip'}
							</button>
						{/if}
					</div>
				{/each}
			</div>

			<div class="modal-action">
				<button class="btn btn-ghost" onclick={() => (step = 'upload')}>Back</button>
				<button
					class="btn btn-primary"
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
	<button class="modal-backdrop" aria-label="Close" onclick={onClose}></button>
</div>
