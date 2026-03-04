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
		<h2 class="text-xl font-bold">Rewards</h2>
		<PointsBadge points={data.myPoints} />
	</div>

	<div role="tablist" class="tabs tabs-bordered">
		<button
			role="tab"
			class="tab"
			class:tab-active={activeTab === 'catalog'}
			onclick={() => (activeTab = 'catalog')}
		>
			Catalog
		</button>
		{#if data.isAdmin}
			<button
				role="tab"
				class="tab"
				class:tab-active={activeTab === 'pending'}
				onclick={() => (activeTab = 'pending')}
			>
				Pending
				{#if data.pendingRewards.length > 0}
					<span class="badge badge-warning badge-xs ml-1">{data.pendingRewards.length}</span>
				{/if}
			</button>
		{/if}
	</div>

	{#if activeTab === 'catalog'}
		{#if data.approvedRewards.length === 0}
			<p class="text-sm text-base-content/50">No rewards yet. Propose one!</p>
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
			<p class="text-sm text-base-content/50">No pending proposals.</p>
		{:else}
			<div class="flex flex-col gap-3">
				{#each data.pendingRewards as reward (reward.id)}
					<div class="card bg-base-100 shadow-sm">
						<div class="card-body p-4">
							<h3 class="text-sm font-bold">{reward.name}</h3>
							{#if reward.description}
								<p class="text-xs text-base-content/60">{reward.description}</p>
							{/if}
							<p class="text-xs text-base-content/50">
								Proposed by {(reward as Record<string, unknown>).users
									? ((reward as Record<string, unknown>).users as Record<string, unknown>)
											?.display_name
									: 'Unknown'}
							</p>
							<div class="mt-2 flex items-center gap-2">
								<form method="POST" action="?/approve" class="flex items-center gap-1">
									<input type="hidden" name="reward_id" value={reward.id} />
									<input
										name="point_cost"
										type="number"
										value={reward.point_cost}
										min="1"
										class="input input-bordered input-xs w-20"
									/>
									<button class="btn btn-success btn-xs">Approve</button>
								</form>
								<form method="POST" action="?/reject">
									<input type="hidden" name="reward_id" value={reward.id} />
									<button class="btn btn-error btn-xs">Reject</button>
								</form>
							</div>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	{/if}

	<button class="btn btn-primary btn-sm" onclick={() => (showProposalModal = true)}>
		Propose Reward
	</button>

	<RewardProposalModal bind:open={showProposalModal} />

	<a href={resolve('/gamification')} class="btn btn-ghost btn-sm">Back to Dashboard</a>
</div>
