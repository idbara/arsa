<script lang="ts">
	import type { Reward } from '$lib/types/gamification';

	let {
		reward,
		myPoints,
		canRedeem = true
	}: { reward: Reward; myPoints: number; canRedeem?: boolean } = $props();

	let affordable = $derived(myPoints >= reward.point_cost);
</script>

<div class="shadow-soft rounded-2xl bg-base-100 p-4 press-scale">
	<h3 class="text-sm font-bold">{reward.name}</h3>
	{#if reward.description}
		<p class="text-subtle mt-1 text-xs">{reward.description}</p>
	{/if}
	<div class="mt-3 flex items-center justify-between">
		<span class="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">{reward.point_cost} pts</span>
		{#if canRedeem}
			<form method="POST" action="?/redeem">
				<input type="hidden" name="reward_id" value={reward.id} />
				<button class="btn btn-primary btn-xs rounded-lg" disabled={!affordable}>
					{affordable ? 'Redeem' : `Need ${reward.point_cost - myPoints} more`}
				</button>
			</form>
		{/if}
	</div>
</div>
