<script lang="ts">
	import type { LeaderboardEntry } from '$lib/types/gamification';

	let { entries, currentUserId }: { entries: LeaderboardEntry[]; currentUserId: string } = $props();
</script>

<div class="overflow-hidden rounded-xl">
	<table class="table table-sm text-sm">
		<thead>
			<tr class="bg-base-200/50">
				<th>#</th>
				<th>Member</th>
				<th>This Month</th>
				<th>Total</th>
				<th>Streak</th>
			</tr>
		</thead>
		<tbody>
			{#each entries as entry, i (entry.user_id)}
				<tr class={entry.user_id === currentUserId ? 'bg-primary/5' : ''}>
					<td class="font-medium">{i + 1}</td>
					<td>{entry.display_name}</td>
					<td class="font-mono text-success">{entry.points_this_month}</td>
					<td class="font-mono">{entry.current_points}</td>
					<td>{entry.streak_days > 0 ? `${entry.streak_days}d` : '-'}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
