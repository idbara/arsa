<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';

	let { data, form } = $props();

	let inviteLink = $derived(form?.inviteLink ?? data.inviteLink);
	let copied = $state(false);

	async function copyLink() {
		if (!inviteLink) return;
		await navigator.clipboard.writeText(inviteLink);
		copied = true;
		setTimeout(() => (copied = false), 2000);
	}
</script>

<div class="card w-full max-w-sm bg-base-100 shadow-xl">
	<div class="card-body">
		<h2 class="card-title justify-center text-2xl">Invite Your Partner</h2>
		<p class="text-center text-base-content/60">
			Share this link so they can join your family workspace
		</p>

		{#if form?.error}
			<div class="alert alert-error text-sm">
				{form.error}
			</div>
		{/if}

		{#if inviteLink}
			<div class="flex flex-col gap-2">
				<input
					type="text"
					class="input input-bordered w-full text-sm"
					value={inviteLink}
					readonly
				/>
				<button class="btn btn-secondary w-full" onclick={copyLink}>
					{copied ? 'Copied!' : 'Copy Link'}
				</button>
			</div>
		{:else}
			<form method="POST" action="?/generate" use:enhance>
				<button type="submit" class="btn btn-primary w-full">Generate Invite Link</button>
			</form>
		{/if}

		<div class="divider"></div>

		<a href={resolve('/')} class="btn btn-ghost w-full">Skip for now</a>
	</div>
</div>
