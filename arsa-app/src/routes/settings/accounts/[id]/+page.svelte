<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';

	let { data, form } = $props();
	let showDeleteConfirm = $state(false);
</script>

<h1 class="mb-6 text-2xl font-bold">Edit Account</h1>

{#if form?.error}
	<div class="alert alert-error mb-4 text-sm">{form.error}</div>
{/if}

<form method="POST" action="?/update" use:enhance class="flex flex-col gap-4">
	<label class="floating-label">
		<span>Account Name</span>
		<input
			name="name"
			type="text"
			placeholder="Account Name"
			class="input input-bordered w-full"
			value={data.account.name}
			required
		/>
	</label>

	<label class="form-control w-full">
		<div class="label"><span class="label-text">Type</span></div>
		<select name="type" class="select select-bordered w-full" required>
			<option value="bank" selected={data.account.type === 'bank'}>Bank</option>
			<option value="e-wallet" selected={data.account.type === 'e-wallet'}>E-Wallet</option>
			<option value="cash" selected={data.account.type === 'cash'}>Cash</option>
		</select>
	</label>

	<p class="text-sm text-base-content/60">
		Balance: Rp {Number(data.account.balance).toLocaleString('id-ID')}
		<br />
		<span class="text-xs">Balance is updated automatically by transactions.</span>
	</p>

	<div class="flex gap-2">
		<a href={resolve('/settings/accounts')} class="btn btn-ghost flex-1">Cancel</a>
		<button type="submit" class="btn btn-primary flex-1">Save</button>
	</div>
</form>

<div class="divider"></div>

<button class="btn btn-error btn-outline w-full" onclick={() => (showDeleteConfirm = true)}>
	Delete Account
</button>

{#if showDeleteConfirm}
	<div class="modal modal-open">
		<div class="modal-box">
			<h3 class="text-lg font-bold">Delete "{data.account.name}"?</h3>
			<p class="py-4 text-base-content/60">
				This cannot be undone. Accounts with transactions cannot be deleted.
			</p>
			<div class="modal-action">
				<button class="btn btn-ghost" onclick={() => (showDeleteConfirm = false)}>Cancel</button>
				<form method="POST" action="?/delete" use:enhance>
					<button type="submit" class="btn btn-error">Delete</button>
				</form>
			</div>
		</div>
		<button class="modal-backdrop" aria-label="Close" onclick={() => (showDeleteConfirm = false)}
		></button>
	</div>
{/if}
