<script lang="ts">
	import { resolve } from '$app/paths';
	import LeaderboardTable from '$lib/components/LeaderboardTable.svelte';
	import PointEventItem from '$lib/components/PointEventItem.svelte';
	import StreakIndicator from '$lib/components/StreakIndicator.svelte';

	let { data } = $props();
</script>

<div class="flex flex-col gap-4">
	<h2 class="text-xl font-bold">Gamification</h2>

	<div class="stats stats-horizontal w-full shadow">
		<div class="stat">
			<div class="stat-title">Your Points</div>
			<div class="stat-value text-primary">{data.myProfile?.current_points ?? 0}</div>
		</div>
		<div class="stat">
			<div class="stat-title">Streak</div>
			<div class="stat-value">
				<StreakIndicator days={data.myProfile?.streak_days ?? 0} />
			</div>
		</div>
	</div>

	<div class="card bg-base-200">
		<div class="card-body p-4">
			<h3 class="card-title text-base">Leaderboard</h3>
			<LeaderboardTable entries={data.leaderboard} currentUserId={data.userId} />
		</div>
	</div>

	<div class="card bg-base-200">
		<div class="card-body p-4">
			<h3 class="card-title text-base">Recent Activity</h3>
			{#if data.recentEvents.length === 0}
				<p class="text-sm text-base-content/50">No point events yet.</p>
			{:else}
				<div class="divide-y divide-base-300">
					{#each data.recentEvents as event (event.id)}
						<PointEventItem {event} />
					{/each}
				</div>
			{/if}
		</div>
	</div>

	<div class="flex gap-2">
		<a href={resolve('/gamification/rewards')} class="btn btn-outline btn-sm flex-1">Rewards</a>
		<a href={resolve('/gamification/history')} class="btn btn-outline btn-sm flex-1">History</a>
	</div>
</div>
