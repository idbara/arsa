<script lang="ts">
	import { resolve } from '$app/paths';

	let { data } = $props();
</script>

<div class="mb-6 flex items-center justify-between">
	<h1 class="text-2xl font-bold">Accounts</h1>
	<a href={resolve('/settings/accounts/new')} class="btn btn-primary btn-sm">+ Add</a>
</div>

{#if data.accounts.length === 0}
	<div class="py-10 text-center text-base-content/60">
		<p>No accounts yet.</p>
		<a href={resolve('/settings/accounts/new')} class="link link-primary"
			>Create your first account</a
		>
	</div>
{:else}
	<div class="flex flex-col gap-2">
		{#each data.accounts as account (account.id)}
			<a
				href={resolve('/settings/accounts/[id]', { id: account.id })}
				class="card bg-base-100 shadow-sm"
			>
				<div class="card-body flex-row items-center justify-between p-4">
					<div>
						<p class="font-medium">{account.name}</p>
						<p class="text-sm capitalize text-base-content/60">{account.type}</p>
					</div>
					<p class="font-mono font-bold">
						Rp {Number(account.balance).toLocaleString('id-ID')}
					</p>
				</div>
			</a>
		{/each}
	</div>
{/if}
