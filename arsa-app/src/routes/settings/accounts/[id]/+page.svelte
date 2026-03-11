<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';

	let { data, form } = $props();
	let showDeleteConfirm = $state(false);
</script>

<h1 class="heading-xl mb-6">Edit Account</h1>

{#if form?.error}
	<div class="animate-fade-in mb-4 rounded-xl bg-error/10 px-4 py-2.5 text-sm text-error">{form.error}</div>
{/if}

<form method="POST" action="?/update" use:enhance class="flex flex-col gap-4">
	<label class="floating-label">
		<span>Account Name</span>
		<input
			name="name"
			type="text"
			placeholder="Account Name"
			class="input input-bordered w-full rounded-xl"
			value={data.account.name}
			required
		/>
	</label>

	<label class="form-control w-full">
		<div class="label"><span class="text-sm font-medium">Type</span></div>
		<select name="type" class="select select-bordered w-full rounded-xl" required>
			<option value="bank" selected={data.account.type === 'bank'}>Bank</option>
			<option value="e-wallet" selected={data.account.type === 'e-wallet'}>E-Wallet</option>
			<option value="cash" selected={data.account.type === 'cash'}>Cash</option>
		</select>
	</label>

	<p class="text-subtle text-sm">
		Balance: Rp {Number(data.account.balance).toLocaleString('id-ID')}
		<br />
		<span class="text-xs">Balance is updated automatically by transactions.</span>
	</p>

	<div class="flex gap-2">
		<a href={resolve('/settings/accounts')} class="btn btn-ghost flex-1 rounded-xl">Cancel</a>
		<button type="submit" class="btn btn-primary flex-1 rounded-xl">Save</button>
	</div>
</form>

<div class="divider"></div>

<button class="btn btn-error btn-outline w-full rounded-xl" onclick={() => (showDeleteConfirm = true)}>
	Delete Account
</button>

{#if showDeleteConfirm}
	<div class="modal modal-open">
		<div class="modal-box rounded-2xl">
			<h3 class="heading-lg">Delete "{data.account.name}"?</h3>
			<p class="text-subtle py-4">
				This cannot be undone. Accounts with transactions cannot be deleted.
			</p>
			<div class="modal-action">
				<button class="btn btn-ghost rounded-xl" onclick={() => (showDeleteConfirm = false)}>Cancel</button>
				<form method="POST" action="?/delete" use:enhance>
					<button type="submit" class="btn btn-error rounded-xl">Delete</button>
				</form>
			</div>
		</div>
		<button class="modal-backdrop bg-black/30" aria-label="Close" onclick={() => (showDeleteConfirm = false)}></button>
	</div>
{/if}
