<script lang="ts">
	import '../app.css';
	import { invalidate } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import BottomNav from '$lib/components/BottomNav.svelte';
	import AddTransaction from '$lib/components/AddTransaction.svelte';

	let { data, children } = $props();
	let { supabase, session } = $derived(data);

	let showAddModal = $state(false);

	onMount(() => {
		const { data: authData } = supabase.auth.onAuthStateChange((_, newSession) => {
			if (newSession?.expires_at !== session?.expires_at) {
				invalidate('supabase:auth');
			}
		});

		return () => authData.subscription.unsubscribe();
	});

	let isOnboarding = $derived(page.url.pathname.startsWith('/onboarding'));
	let showAppShell = $derived(!!session && !isOnboarding);
</script>

{#if showAppShell}
	<div class="flex min-h-screen flex-col">
		<header class="navbar bg-base-200">
			<div class="flex-1">
				<span class="text-xl font-bold">Arsa</span>
			</div>
			<div class="flex-none">
				<ThemeToggle />
			</div>
		</header>

		<main class="flex-1 px-4 pb-20 pt-6">
			{@render children()}
		</main>

		<BottomNav onAdd={() => (showAddModal = true)} />
	</div>

	{#if showAddModal}
		<AddTransaction
			accounts={data.accounts}
			categories={data.categories}
			onClose={() => (showAddModal = false)}
		/>
	{/if}
{:else}
	<div class="flex min-h-screen items-center justify-center bg-base-200 px-4">
		{@render children()}
	</div>
{/if}
