<script lang="ts">
	import { enhance } from '$app/forms';

	let { form } = $props();
</script>

<div class="card shadow-card w-full max-w-sm rounded-2xl bg-base-100">
	<div class="card-body">
		<h2 class="text-center text-2xl font-bold text-primary">Welcome to Arsa</h2>
		<p class="text-subtle text-center text-sm">
			Create your family workspace or join an existing one
		</p>

		{#if form?.error}
			<div class="animate-fade-in rounded-xl bg-error/10 px-4 py-2.5 text-sm text-error">
				{form.error}
			</div>
		{/if}

		<form method="POST" action="?/create" use:enhance class="flex flex-col gap-3">
			<label class="floating-label">
				<span>Family Name</span>
				<input
					name="family_name"
					type="text"
					placeholder="Family Name"
					class="input input-bordered w-full rounded-xl"
					required
				/>
			</label>

			<button type="submit" class="btn btn-primary w-full rounded-xl">Create Family</button>
		</form>

		<div class="divider">OR</div>

		<p class="text-subtle text-center text-sm">
			Have an invite link from your partner? Open the link directly to join their family.
		</p>
	</div>
</div>
