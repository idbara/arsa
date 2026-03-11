<script lang="ts">
	import { resolve } from '$app/paths';
	import PointsBadge from '$lib/components/PointsBadge.svelte';
	import RewardCard from '$lib/components/RewardCard.svelte';
	import RewardProposalModal from '$lib/components/RewardProposalModal.svelte';

	let { data } = $props();
	let activeTab: 'catalog' | 'pending' = $state('catalog');
	let showProposalModal = $state(false);
</script>

<div class="flex flex-col gap-4">
	<div class="flex items-center justify-between">
		<h2 class="heading-xl">Rewards</h2>
		<PointsBadge points={data.myPoints} />
	</div>

	<!-- Tab switcher -->
	<div class="rounded-xl bg-base-200/50 p-1">
		<div class="flex">
			<button
				class="flex-1 rounded-lg py-2 text-sm transition-all {activeTab === 'catalog' ? 'shadow-soft bg-base-100 font-medium' : 'text-base-content/50'}"
				onclick={() => (activeTab = 'catalog')}
			>
				Catalog
			</button>
			{#if data.isAdmin}
				<button
					class="flex-1 rounded-lg py-2 text-sm transition-all {activeTab === 'pending' ? 'shadow-soft bg-base-100 font-medium' : 'text-base-content/50'}"
					onclick={() => (activeTab = 'pending')}
				>
					Pending
					{#if data.pendingRewards.length > 0}
						<span class="ml-1 rounded-full bg-warning/20 px-1.5 py-0.5 text-[10px] font-bold text-warning">{data.pendingRewards.length}</span>
					{/if}
				</button>
			{/if}
		</div>
	</div>

	{#if activeTab === 'catalog'}
		{#if data.approvedRewards.length === 0}
			<p class="text-subtle text-sm">No rewards yet. Propose one!</p>
		{:else}
			<div class="grid grid-cols-1 gap-3">
				{#each data.approvedRewards as reward (reward.id)}
					<RewardCard {reward} myPoints={data.myPoints} />
				{/each}
			</div>
		{/if}
	{/if}

	{#if activeTab === 'pending' && data.isAdmin}
		{#if data.pendingRewards.length === 0}
			<p class="text-subtle text-sm">No pending proposals.</p>
		{:else}
			<div class="flex flex-col gap-3">
				{#each data.pendingRewards as reward (reward.id)}
					<div class="shadow-soft rounded-2xl bg-base-100 p-4">
						<h3 class="text-sm font-bold">{reward.name}</h3>
						{#if reward.description}
							<p class="text-subtle mt-1 text-xs">{reward.description}</p>
						{/if}
						<p class="text-subtle mt-1 text-xs">
							Proposed by {(reward as Record<string, unknown>).users
								? ((reward as Record<string, unknown>).users as Record<string, unknown>)
										?.display_name
								: 'Unknown'}
						</p>
						<div class="mt-3 flex items-center gap-2">
							<form method="POST" action="?/approve" class="flex items-center gap-1">
								<input type="hidden" name="reward_id" value={reward.id} />
								<input
									name="point_cost"
									type="number"
									value={reward.point_cost}
									min="1"
									class="input input-bordered input-xs w-20 rounded-lg"
								/>
								<button class="btn btn-success btn-xs rounded-lg">Approve</button>
							</form>
							<form method="POST" action="?/reject">
								<input type="hidden" name="reward_id" value={reward.id} />
								<button class="btn btn-error btn-xs rounded-lg">Reject</button>
							</form>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	{/if}

	<button class="btn btn-primary btn-sm rounded-xl" onclick={() => (showProposalModal = true)}>
		Propose Reward
	</button>

	<RewardProposalModal bind:open={showProposalModal} />

	<a href={resolve('/gamification')} class="btn btn-ghost btn-sm rounded-xl">Back to Dashboard</a>
</div>
