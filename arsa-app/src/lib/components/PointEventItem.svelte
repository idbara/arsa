<script lang="ts">
	import type { PointEvent } from '$lib/types/gamification';

	let { event }: { event: PointEvent } = $props();

	let dateStr = $derived(
		new Date(event.created_at).toLocaleDateString('id-ID', {
			day: 'numeric',
			month: 'short'
		})
	);
</script>

<div class="flex items-center justify-between py-2">
	<div class="flex items-center gap-2">
		<span class="size-1.5 rounded-full {event.points > 0 ? 'bg-success' : 'bg-error'}"></span>
		<div>
			<p class="text-sm">{event.description}</p>
			<p class="text-subtle text-xs">{dateStr}</p>
		</div>
	</div>
	<span class="font-mono text-sm {event.points > 0 ? 'font-bold text-success' : 'font-bold text-error'}">
		{event.points > 0 ? '+' : ''}{event.points}
	</span>
</div>
