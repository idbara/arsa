<script lang="ts">
	import { resolve } from '$app/paths';

	let { data } = $props();
</script>

<div class="mb-6 flex items-center justify-between">
	<h1 class="heading-xl">Accounts</h1>
	<a href={resolve('/settings/accounts/new')} class="btn btn-primary btn-sm rounded-xl">+ Add</a>
</div>

{#if data.accounts.length === 0}
	<div class="text-subtle py-10 text-center">
		<p>No accounts yet.</p>
		<a href={resolve('/settings/accounts/new')} class="font-medium text-primary">
			Create your first account
		</a>
	</div>
{:else}
	<div class="flex flex-col gap-2">
		{#each data.accounts as account (account.id)}
			<a
				href={resolve('/settings/accounts/[id]', { id: account.id })}
				class="shadow-soft rounded-xl bg-base-100 press-scale"
			>
				<div class="flex items-center justify-between p-4">
					<div>
						<p class="text-sm font-medium">{account.name}</p>
						<p class="text-subtle text-xs capitalize">{account.type}</p>
					</div>
					<p class="font-mono text-sm font-bold">
						Rp {Number(account.balance).toLocaleString('id-ID')}
					</p>
				</div>
			</a>
		{/each}
	</div>
{/if}
