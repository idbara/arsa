<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';

	let { form } = $props();
</script>

<div class="card shadow-card w-full max-w-sm rounded-2xl bg-base-100">
	<div class="card-body">
		<h2 class="text-center text-2xl font-bold text-primary">Arsa</h2>
		<p class="text-subtle text-center text-sm">Sign in to your account</p>

		{#if form?.error}
			<div class="animate-fade-in rounded-xl bg-error/10 px-4 py-2.5 text-sm text-error">
				{form.error}
			</div>
		{/if}

		<form method="POST" use:enhance class="flex flex-col gap-3">
			<label class="floating-label">
				<span>Email</span>
				<input
					name="email"
					type="email"
					placeholder="Email"
					class="input input-bordered w-full rounded-xl"
					value={form?.email ?? ''}
					required
				/>
			</label>

			<label class="floating-label">
				<span>Password</span>
				<input
					name="password"
					type="password"
					placeholder="Password"
					class="input input-bordered w-full rounded-xl"
					required
				/>
			</label>

			<button type="submit" class="btn btn-primary w-full rounded-xl">Sign In</button>
		</form>

		<p class="text-center text-sm">
			Don't have an account?
			<a href={resolve('/register')} class="font-medium text-primary">Register</a>
		</p>
	</div>
</div>
