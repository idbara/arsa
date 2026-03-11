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
	<div class="animate-slide-down border-b border-warning/20 bg-warning/10 px-4 py-2.5 text-sm text-warning">
		<div class="flex items-center justify-between">
			<span>You're offline. Changes will sync when reconnected.</span>
			{#if pendingCount > 0}
				<span class="rounded-full bg-warning/20 px-2 py-0.5 text-xs font-medium">{pendingCount} pending</span>
			{/if}
		</div>
	</div>
{/if}

{#if toastMessage}
	<div class="fixed right-4 top-4 z-50 animate-fade-in">
		<div class="shadow-elevated rounded-xl bg-base-100 px-4 py-3 text-sm">
			<span>{toastMessage}</span>
		</div>
	</div>
{/if}

{#if showAppShell}
	<div class="flex min-h-screen flex-col bg-base-100">
		<header class="sticky top-0 z-40 border-b border-base-200 bg-base-100 px-4">
			<div class="flex h-14 items-center justify-between">
				<span class="text-xl font-bold text-primary">Arsa</span>
				<ThemeToggle />
			</div>
		</header>

		<main class="flex-1 px-4 pb-24 pt-4">
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
	<div class="fixed inset-x-4 bottom-24 z-50 flex justify-center">
		<div class="shadow-elevated animate-slide-up w-full max-w-sm rounded-2xl bg-base-100 p-4">
			<p class="mb-3 text-sm font-medium">Enable notifications for budget alerts and rewards?</p>
			<div class="flex gap-2">
				<button class="btn btn-ghost btn-sm flex-1 rounded-xl" onclick={handlePushDismiss}>No thanks</button>
				<button class="btn btn-primary btn-sm flex-1 rounded-xl" onclick={handlePushAccept}>Enable</button>
			</div>
		</div>
	</div>
{/if}
