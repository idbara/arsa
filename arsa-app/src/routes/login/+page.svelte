<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';

	let { form } = $props();
</script>

<div class="card w-full max-w-sm bg-base-100 shadow-xl">
	<div class="card-body">
		<h2 class="card-title justify-center text-2xl">Arsa</h2>
		<p class="text-center text-base-content/60">Sign in to your account</p>

		{#if form?.error}
			<div class="alert alert-error text-sm">
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
					class="input input-bordered w-full"
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
					class="input input-bordered w-full"
					required
				/>
			</label>

			<button type="submit" class="btn btn-primary w-full">Sign In</button>
		</form>

		<p class="text-center text-sm">
			Don't have an account?
			<a href={resolve('/register')} class="link link-primary">Register</a>
		</p>
	</div>
</div>
