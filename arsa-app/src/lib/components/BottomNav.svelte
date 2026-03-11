<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';

	let { onAdd }: { onAdd: () => void } = $props();

	function isActive(href: string): boolean {
		if (href === '/') return page.url.pathname === '/';
		return page.url.pathname.startsWith(href);
	}
</script>

<nav class="fixed inset-x-0 bottom-0 z-40 border-t border-base-200 bg-base-100 pb-[env(safe-area-inset-bottom)]">
	<div class="mx-auto flex h-16 max-w-lg items-center justify-around">
		<a href={resolve('/')} class="flex flex-col items-center gap-0.5 {isActive('/') ? 'text-primary' : 'text-base-content/40'}">
			<svg xmlns="http://www.w3.org/2000/svg" class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="m3 12 2-2m0 0 7-7 7 7M5 10v10a1 1 0 0 0 1 1h3m10-11 2 2m-2-2v10a1 1 0 0 1-1 1h-3m-4 0a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1" />
			</svg>
			<span class="text-[10px] font-medium">Home</span>
		</a>

		<a href={resolve('/history')} class="flex flex-col items-center gap-0.5 {isActive('/history') ? 'text-primary' : 'text-base-content/40'}">
			<svg xmlns="http://www.w3.org/2000/svg" class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
			</svg>
			<span class="text-[10px] font-medium">History</span>
		</a>

		<button onclick={onAdd} aria-label="Add transaction" class="shadow-card flex size-12 items-center justify-center rounded-full bg-primary text-primary-content press-scale">
			<svg xmlns="http://www.w3.org/2000/svg" class="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
				<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
			</svg>
		</button>

		<a href={resolve('/plan')} class="flex flex-col items-center gap-0.5 {isActive('/plan') ? 'text-primary' : 'text-base-content/40'}">
			<svg xmlns="http://www.w3.org/2000/svg" class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" />
			</svg>
			<span class="text-[10px] font-medium">Plan</span>
		</a>

		<a href={resolve('/settings')} class="flex flex-col items-center gap-0.5 {isActive('/settings') ? 'text-primary' : 'text-base-content/40'}">
			<svg xmlns="http://www.w3.org/2000/svg" class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 0 0 1.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 0 0-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 0 0-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 0 0-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 0 0-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 0 0 1.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
				<path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" />
			</svg>
			<span class="text-[10px] font-medium">Settings</span>
		</a>
	</div>
</nav>
