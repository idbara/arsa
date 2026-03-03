<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';

	let { data, form } = $props();
</script>

<div class="card w-full max-w-sm bg-base-100 shadow-xl">
	<div class="card-body">
		{#if data.error}
			<h2 class="card-title justify-center text-2xl">Invalid Invite</h2>
			<div class="alert alert-error text-sm">{data.error}</div>
			<a href={resolve('/login')} class="btn btn-primary w-full">Go to Login</a>
		{:else}
			<h2 class="card-title justify-center text-2xl">Join Family</h2>
			<p class="text-center text-base-content/60">
				You've been invited to join <span class="font-bold">{data.familyName}</span>
			</p>

			{#if form?.error}
				<div class="alert alert-error text-sm">{form.error}</div>
			{/if}

			{#if data.isAuthenticated}
				<form method="POST" action="?/join" use:enhance>
					<button type="submit" class="btn btn-primary w-full">Join Family</button>
				</form>
			{:else}
				<a href={resolve('/register')} class="btn btn-primary w-full"> Register to Join </a>
				<a href="{resolve('/login')}?redirect=/invite/{data.token}" class="btn btn-ghost w-full">
					Already have an account? Sign in
				</a>
			{/if}
		{/if}
	</div>
</div>
