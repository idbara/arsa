<script lang="ts">
	import { resolve } from '$app/paths';
	import { FREQUENCY_LABELS } from '$lib/types/subscription';
	import type { Frequency } from '$lib/types/subscription';

	let { data } = $props();

	let showInactive = $state(false);

	const filtered = $derived(
		data.subscriptions.filter((s) => (showInactive ? !s.is_active : s.is_active))
	);

	const categoryColors = [
		'#6366f1', '#f43f5e', '#f59e0b', '#10b981', '#8b5cf6',
		'#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#84cc16'
	];

	function getCategoryColor(name: string): string {
		let hash = 0;
		for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
		return categoryColors[Math.abs(hash) % categoryColors.length];
	}

	function formatRp(amount: number): string {
		return `Rp ${Number(amount).toLocaleString('id-ID')}`;
	}

	function daysUntilDue(dateStr: string): number {
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		const due = new Date(dateStr + 'T00:00:00');
		return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
	}

	function dueLabel(dateStr: string): string {
		const days = daysUntilDue(dateStr);
		if (days < 0) return 'Terlambat!';
		if (days === 0) return 'Hari ini!';
		if (days === 1) return 'Besok!';
		const d = new Date(dateStr + 'T00:00:00');
		return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
	}

	function dueColor(dateStr: string): string {
		const days = daysUntilDue(dateStr);
		if (days <= 3) return 'text-warning';
		return 'text-subtle';
	}
</script>

<div class="mb-6 flex items-center justify-between">
	<h1 class="heading-xl">Langganan</h1>
	<a href={resolve('/plan/subscriptions/new')} class="btn btn-primary btn-sm rounded-xl">+ Tambah</a>
</div>

<!-- Tab filter -->
<div class="mb-4 rounded-xl bg-base-200/50 p-1">
	<div class="flex">
		<button
			class="flex-1 rounded-lg px-4 py-2 text-sm transition-all {!showInactive ? 'shadow-soft bg-base-100 font-medium text-base-content' : 'text-base-content/50'}"
			onclick={() => (showInactive = false)}
		>
			Aktif
		</button>
		<button
			class="flex-1 rounded-lg px-4 py-2 text-sm transition-all {showInactive ? 'shadow-soft bg-base-100 font-medium text-base-content' : 'text-base-content/50'}"
			onclick={() => (showInactive = true)}
		>
			Nonaktif
		</button>
	</div>
</div>

{#if filtered.length === 0}
	<div class="text-subtle py-10 text-center">
		<p>{showInactive ? 'Tidak ada langganan nonaktif.' : 'Belum ada langganan.'}</p>
		{#if !showInactive}
			<a href={resolve('/plan/subscriptions/new')} class="font-medium text-primary">
				Tambah langganan pertama
			</a>
		{/if}
	</div>
{:else}
	<div class="flex flex-col gap-2">
		{#each filtered as sub (sub.id)}
			<a
				href={resolve('/plan/subscriptions/[id]', { id: sub.id })}
				class="shadow-soft rounded-xl bg-base-100 press-scale"
			>
				<div class="flex items-center gap-3 p-4">
					<div
						class="category-icon"
						style="background-color: {getCategoryColor(sub.name)}"
					>
						{sub.name.charAt(0).toUpperCase()}
					</div>
					<div class="min-w-0 flex-1">
						<p class="truncate text-sm font-medium">{sub.name}</p>
						<div class="flex items-center gap-2">
							<span class="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
								{FREQUENCY_LABELS[sub.frequency as Frequency]}
							</span>
							{#if sub.is_active}
								<span class="text-[10px] {dueColor(sub.next_due_date)}">
									{dueLabel(sub.next_due_date)}
								</span>
							{/if}
						</div>
					</div>
					<span class="font-mono text-sm font-bold text-error">
						{formatRp(sub.amount)}
					</span>
				</div>
			</a>
		{/each}
	</div>
{/if}
