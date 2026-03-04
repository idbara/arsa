<script lang="ts">
	import type { Reward } from '$lib/types/gamification';

	let {
		reward,
		myPoints,
		canRedeem = true
	}: { reward: Reward; myPoints: number; canRedeem?: boolean } = $props();

	let affordable = $derived(myPoints >= reward.point_cost);
</script>

<div class="card bg-base-100 shadow-sm">
	<div class="card-body p-4">
		<h3 class="card-title text-sm">{reward.name}</h3>
		{#if reward.description}
			<p class="text-xs text-base-content/60">{reward.description}</p>
		{/if}
		<div class="card-actions mt-2 items-center justify-between">
			<span class="badge badge-secondary">{reward.point_cost} pts</span>
			{#if canRedeem}
				<form method="POST" action="?/redeem">
					<input type="hidden" name="reward_id" value={reward.id} />
					<button class="btn btn-primary btn-xs" disabled={!affordable}>
						{affordable ? 'Redeem' : `Need ${reward.point_cost - myPoints} more`}
					</button>
				</form>
			{/if}
		</div>
	</div>
</div>
