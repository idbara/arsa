<script lang="ts">
	import '../app.css';
	import { invalidate } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import BottomNav from '$lib/components/BottomNav.svelte';
	import AddTransaction from '$lib/components/AddTransaction.svelte';
	import { startSyncListener } from '$lib/sync';
	import { onlineStatus } from '$lib/online-status.svelte';
	import { getPendingCount } from '$lib/offline';
	import { wasPushPrompted, markPushPrompted, subscribeToPush } from '$lib/push';

	let { data, children } = $props();
	let { supabase, session } = $derived(data);

	let showAddModal = $state(false);
	let toastMessage = $state('');
	let pendingCount = $state(0);
	let showPushPrompt = $state(false);

	async function updatePendingCount() {
		if (browser) pendingCount = await getPendingCount();
	}

	onMount(() => {
		const { data: authData } = supabase.auth.onAuthStateChange((_, newSession) => {
			if (newSession?.expires_at !== session?.expires_at) {
				invalidate('supabase:auth');
			}
		});

		if (browser && 'serviceWorker' in navigator) {
			navigator.serviceWorker.register('/service-worker.js');
		}

		const cleanupSync = startSyncListener((result) => {
			let msg = '';
			if (result.synced > 0) {
				msg = `Synced ${result.synced} item${result.synced > 1 ? 's' : ''}`;
			}
			if (result.failed > 0) {
				msg += `${msg ? '. ' : ''}${result.failed} failed to sync`;
			}
			toastMessage = msg;
			setTimeout(() => {
				toastMessage = '';
			}, 4000);
			updatePendingCount();
		});

		updatePendingCount();

		if (browser && 'PushManager' in window && !wasPushPrompted()) {
			setTimeout(() => {
				showPushPrompt = true;
			}, 5000);
		}

		return () => {
			authData.subscription.unsubscribe();
			cleanupSync();
		};
	});

	async function handlePushAccept() {
		showPushPrompt = false;
		markPushPrompted();
		if (session?.user?.id) {
			const vapidKey = data.vapidPublicKey;
			if (vapidKey) {
				await subscribeToPush(supabase, session.user.id, vapidKey);
			}
		}
	}

	function handlePushDismiss() {
		showPushPrompt = false;
		markPushPrompted();
	}

	let isOnboarding = $derived(page.url.pathname.startsWith('/onboarding'));
	let showAppShell = $derived(!!session && !isOnboarding);
</script>

{#if !onlineStatus.isOnline}
	<div class="alert alert-warning rounded-none py-2 text-sm">
		<span>You're offline. Changes will sync when reconnected.</span>
		{#if pendingCount > 0}
			<span class="badge badge-sm">{pendingCount} pending</span>
		{/if}
	</div>
{/if}

{#if toastMessage}
	<div class="toast toast-top toast-end z-50">
		<div class="alert alert-success py-2 text-sm">
			<span>{toastMessage}</span>
		</div>
	</div>
{/if}

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

{#if showPushPrompt}
	<div class="toast toast-bottom toast-center z-50">
		<div class="alert shadow-lg">
			<span>Enable notifications for budget alerts and rewards?</span>
			<div class="flex gap-2">
				<button class="btn btn-sm btn-ghost" onclick={handlePushDismiss}>No thanks</button>
				<button class="btn btn-sm btn-primary" onclick={handlePushAccept}>Enable</button>
			</div>
		</div>
	</div>
{/if}
