<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
</script>

<h1 class="mb-6 text-2xl font-bold">Settings</h1>

<div class="flex flex-col gap-3">
	<a href={resolve('/settings/accounts')} class="btn btn-ghost justify-start gap-3 text-left">
		<svg
			xmlns="http://www.w3.org/2000/svg"
			class="size-5"
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
		>
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 0 0 3-3V8a3 3 0 0 0-3-3H6a3 3 0 0 0-3 3v8a3 3 0 0 0 3 3z"
			/>
		</svg>
		Accounts & Wallets
	</a>

	<a href={resolve('/settings/categories')} class="btn btn-ghost justify-start gap-3 text-left">
		<svg
			xmlns="http://www.w3.org/2000/svg"
			class="size-5"
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
		>
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 0 1 0 2.828l-7 7a2 2 0 0 1-2.828 0l-7-7A2 2 0 0 1 3 12V7a4 4 0 0 1 4-4z"
			/>
		</svg>
		Categories & Budgets
	</a>

	<div class="divider"></div>

	<form method="POST" action="/logout" use:enhance>
		<button type="submit" class="btn btn-ghost w-full justify-start gap-3 text-left text-error">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="size-5"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h4a3 3 0 0 1 3 3v1"
				/>
			</svg>
			Sign Out
		</button>
	</form>
</div>
