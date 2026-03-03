<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';

	let { form } = $props();
</script>

<div class="card w-full max-w-sm bg-base-100 shadow-xl">
	<div class="card-body">
		<h2 class="card-title justify-center text-2xl">Create Account</h2>
		<p class="text-center text-base-content/60">Join Arsa to manage your family finances</p>

		{#if form?.error}
			<div class="alert alert-error text-sm">
				{form.error}
			</div>
		{/if}

		<form method="POST" use:enhance class="flex flex-col gap-3">
			<label class="floating-label">
				<span>Display Name</span>
				<input
					name="display_name"
					type="text"
					placeholder="Display Name"
					class="input input-bordered w-full"
					value={form?.displayName ?? ''}
					required
				/>
			</label>

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
					minlength="6"
					required
				/>
			</label>

			<button type="submit" class="btn btn-primary w-full">Register</button>
		</form>

		<p class="text-center text-sm">
			Already have an account?
			<a href={resolve('/login')} class="link link-primary">Sign in</a>
		</p>
	</div>
</div>
