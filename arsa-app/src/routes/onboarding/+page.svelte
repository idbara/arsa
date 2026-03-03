<script lang="ts">
	import { enhance } from '$app/forms';

	let { form } = $props();
</script>

<div class="card w-full max-w-sm bg-base-100 shadow-xl">
	<div class="card-body">
		<h2 class="card-title justify-center text-2xl">Welcome to Arsa</h2>
		<p class="text-center text-base-content/60">
			Create your family workspace or join an existing one
		</p>

		{#if form?.error}
			<div class="alert alert-error text-sm">
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
					class="input input-bordered w-full"
					required
				/>
			</label>

			<button type="submit" class="btn btn-primary w-full">Create Family</button>
		</form>

		<div class="divider">OR</div>

		<p class="text-center text-sm text-base-content/60">
			Have an invite link from your partner? Open the link directly to join their family.
		</p>
	</div>
</div>
