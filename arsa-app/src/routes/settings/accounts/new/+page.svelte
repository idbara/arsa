<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';

	let { form } = $props();
</script>

<h1 class="mb-6 text-2xl font-bold">Add Account</h1>

{#if form?.error}
	<div class="alert alert-error mb-4 text-sm">{form.error}</div>
{/if}

<form method="POST" use:enhance class="flex flex-col gap-4">
	<label class="floating-label">
		<span>Account Name</span>
		<input
			name="name"
			type="text"
			placeholder="Account Name"
			class="input input-bordered w-full"
			value={form?.name ?? ''}
			required
		/>
	</label>

	<label class="form-control w-full">
		<div class="label"><span class="label-text">Type</span></div>
		<select name="type" class="select select-bordered w-full" required>
			<option value="" disabled selected={!form?.type}>Select type</option>
			<option value="bank" selected={form?.type === 'bank'}>Bank</option>
			<option value="e-wallet" selected={form?.type === 'e-wallet'}>E-Wallet</option>
			<option value="cash" selected={form?.type === 'cash'}>Cash</option>
		</select>
	</label>

	<label class="floating-label">
		<span>Initial Balance</span>
		<input
			name="balance"
			type="number"
			inputmode="decimal"
			placeholder="Initial Balance"
			class="input input-bordered w-full"
			value={form?.balance ?? 0}
			step="any"
		/>
	</label>

	<div class="flex gap-2">
		<a href={resolve('/settings/accounts')} class="btn btn-ghost flex-1">Cancel</a>
		<button type="submit" class="btn btn-primary flex-1">Create</button>
	</div>
</form>
