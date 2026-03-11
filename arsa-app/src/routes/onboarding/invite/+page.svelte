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

<div class="card shadow-card w-full max-w-sm rounded-2xl bg-base-100">
	<div class="card-body">
		<h2 class="text-center text-2xl font-bold text-primary">Invite Your Partner</h2>
		<p class="text-subtle text-center text-sm">
			Share this link so they can join your family workspace
		</p>

		{#if form?.error}
			<div class="animate-fade-in rounded-xl bg-error/10 px-4 py-2.5 text-sm text-error">
				{form.error}
			</div>
		{/if}

		{#if inviteLink}
			<div class="flex flex-col gap-2">
				<input
					type="text"
					class="input input-bordered w-full rounded-xl text-sm"
					value={inviteLink}
					readonly
				/>
				<button class="btn btn-secondary w-full rounded-xl" onclick={copyLink}>
					{copied ? 'Copied!' : 'Copy Link'}
				</button>
			</div>
		{:else}
			<form method="POST" action="?/generate" use:enhance>
				<button type="submit" class="btn btn-primary w-full rounded-xl">Generate Invite Link</button>
			</form>
		{/if}

		<div class="divider"></div>

		<a href={resolve('/')} class="btn btn-ghost w-full rounded-xl">Skip for now</a>
	</div>
</div>
