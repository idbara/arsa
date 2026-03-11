<script lang="ts">
	let { days }: { days: number } = $props();
</script>

{#if days > 0}
	<span class="font-bold text-warning">🔥 {days}d</span>
{:else}
	<span class="text-base-content/40 text-sm">No streak</span>
{/if}
