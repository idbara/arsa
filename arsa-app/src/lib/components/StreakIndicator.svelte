<script lang="ts">
	let { days }: { days: number } = $props();
</script>

{#if days > 0}
	<span class="font-bold text-warning">{days}d streak</span>
{:else}
	<span class="text-base-content/40">No streak</span>
{/if}
