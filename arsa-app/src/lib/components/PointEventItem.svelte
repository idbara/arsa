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
	<div>
		<p class="text-sm">{event.description}</p>
		<p class="text-xs text-base-content/50">{dateStr}</p>
	</div>
	<span class={event.points > 0 ? 'font-bold text-success' : 'font-bold text-error'}>
		{event.points > 0 ? '+' : ''}{event.points}
	</span>
</div>
