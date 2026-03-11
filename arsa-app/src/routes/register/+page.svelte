<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';

	let { form } = $props();
</script>

<div class="card shadow-card w-full max-w-sm rounded-2xl bg-base-100">
	<div class="card-body">
		<h2 class="text-center text-2xl font-bold text-primary">Create Account</h2>
		<p class="text-subtle text-center text-sm">Join Arsa to manage your family finances</p>

		{#if form?.error}
			<div class="animate-fade-in rounded-xl bg-error/10 px-4 py-2.5 text-sm text-error">
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
					class="input input-bordered w-full rounded-xl"
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
					minlength="6"
					required
				/>
			</label>

			<button type="submit" class="btn btn-primary w-full rounded-xl">Register</button>
		</form>

		<p class="text-center text-sm">
			Already have an account?
			<a href={resolve('/login')} class="font-medium text-primary">Sign in</a>
		</p>
	</div>
</div>
