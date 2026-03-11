<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';

	let { data, form } = $props();
</script>

<div class="card shadow-card w-full max-w-sm rounded-2xl bg-base-100">
	<div class="card-body">
		{#if data.error}
			<h2 class="text-center text-2xl font-bold text-primary">Invalid Invite</h2>
			<div class="animate-fade-in rounded-xl bg-error/10 px-4 py-2.5 text-sm text-error">{data.error}</div>
			<a href={resolve('/login')} class="btn btn-primary w-full rounded-xl">Go to Login</a>
		{:else}
			<h2 class="text-center text-2xl font-bold text-primary">Join Family</h2>
			<p class="text-subtle text-center text-sm">
				You've been invited to join <span class="font-bold text-base-content">{data.familyName}</span>
			</p>

			{#if form?.error}
				<div class="animate-fade-in rounded-xl bg-error/10 px-4 py-2.5 text-sm text-error">{form.error}</div>
			{/if}

			{#if data.isAuthenticated}
				<form method="POST" action="?/join" use:enhance>
					<button type="submit" class="btn btn-primary w-full rounded-xl">Join Family</button>
				</form>
			{:else}
				<a href={resolve('/register')} class="btn btn-primary w-full rounded-xl">Register to Join</a>
				<a href="{resolve('/login')}?redirect=/invite/{data.token}" class="btn btn-ghost w-full rounded-xl">
					Already have an account? Sign in
				</a>
			{/if}
		{/if}
	</div>
</div>
