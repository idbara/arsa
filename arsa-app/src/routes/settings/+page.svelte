<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
</script>

<h1 class="heading-xl mb-6">Settings</h1>

<div class="flex flex-col gap-3">
	<a href={resolve('/settings/accounts')} class="flex items-center gap-3 rounded-2xl bg-base-200/30 p-4 press-scale">
		<div class="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
			<svg xmlns="http://www.w3.org/2000/svg" class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 0 0 3-3V8a3 3 0 0 0-3-3H6a3 3 0 0 0-3 3v8a3 3 0 0 0 3 3z" />
			</svg>
		</div>
		<div class="flex-1">
			<p class="text-sm font-medium">Accounts & Wallets</p>
			<p class="text-subtle text-xs">Manage bank accounts, e-wallets, cash</p>
		</div>
		<svg xmlns="http://www.w3.org/2000/svg" class="size-4 text-base-content/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
			<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
		</svg>
	</a>

	<a href={resolve('/settings/categories')} class="flex items-center gap-3 rounded-2xl bg-base-200/30 p-4 press-scale">
		<div class="flex size-10 items-center justify-center rounded-xl bg-secondary/10 text-secondary">
			<svg xmlns="http://www.w3.org/2000/svg" class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 0 1 0 2.828l-7 7a2 2 0 0 1-2.828 0l-7-7A2 2 0 0 1 3 12V7a4 4 0 0 1 4-4z" />
			</svg>
		</div>
		<div class="flex-1">
			<p class="text-sm font-medium">Categories & Budgets</p>
			<p class="text-subtle text-xs">Set spending limits and categories</p>
		</div>
		<svg xmlns="http://www.w3.org/2000/svg" class="size-4 text-base-content/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
			<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
		</svg>
	</a>

	<div class="my-2"></div>

	<form method="POST" action="/logout" use:enhance>
		<button type="submit" class="flex w-full items-center gap-3 rounded-2xl bg-error/5 p-4 text-left text-error press-scale">
			<div class="flex size-10 items-center justify-center rounded-xl bg-error/10">
				<svg xmlns="http://www.w3.org/2000/svg" class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h4a3 3 0 0 1 3 3v1" />
				</svg>
			</div>
			<span class="text-sm font-medium">Sign Out</span>
		</button>
	</form>
</div>
