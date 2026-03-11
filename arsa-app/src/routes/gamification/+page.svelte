<script lang="ts">
	import { resolve } from '$app/paths';
	import LeaderboardTable from '$lib/components/LeaderboardTable.svelte';
	import PointEventItem from '$lib/components/PointEventItem.svelte';
	import StreakIndicator from '$lib/components/StreakIndicator.svelte';

	let { data } = $props();
</script>

<div class="flex flex-col gap-4">
	<h2 class="heading-xl">Gamification</h2>

	<!-- Stats grid -->
	<div class="grid grid-cols-2 gap-3">
		<div class="rounded-2xl border border-primary/10 bg-primary/5 p-4">
			<p class="text-subtle text-xs font-medium uppercase tracking-wider">Your Points</p>
			<p class="mt-1 text-2xl font-bold text-primary">{data.myProfile?.current_points ?? 0}</p>
		</div>
		<div class="rounded-2xl border border-warning/10 bg-warning/5 p-4">
			<p class="text-subtle text-xs font-medium uppercase tracking-wider">Streak</p>
			<p class="mt-1 text-2xl">
				<StreakIndicator days={data.myProfile?.streak_days ?? 0} />
			</p>
		</div>
	</div>

	<!-- Leaderboard -->
	<div class="shadow-soft rounded-2xl bg-base-100 p-4">
		<h3 class="heading-md mb-3">Leaderboard</h3>
		<LeaderboardTable entries={data.leaderboard} currentUserId={data.userId} />
	</div>

	<!-- Recent Activity -->
	<div class="shadow-soft rounded-2xl bg-base-100 p-4">
		<h3 class="heading-md mb-3">Recent Activity</h3>
		{#if data.recentEvents.length === 0}
			<p class="text-subtle text-sm">No point events yet.</p>
		{:else}
			<div class="divide-y divide-base-200">
				{#each data.recentEvents as event (event.id)}
					<PointEventItem {event} />
				{/each}
			</div>
		{/if}
	</div>

	<!-- Action links -->
	<div class="grid grid-cols-2 gap-3">
		<a href={resolve('/gamification/rewards')} class="rounded-xl bg-base-200/50 p-3 text-center text-sm font-medium press-scale">
			Rewards
		</a>
		<a href={resolve('/gamification/history')} class="rounded-xl bg-base-200/50 p-3 text-center text-sm font-medium press-scale">
			History
		</a>
	</div>
</div>
