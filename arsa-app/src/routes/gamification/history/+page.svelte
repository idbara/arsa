<script lang="ts">
	import { resolve } from '$app/paths';
	import PointEventItem from '$lib/components/PointEventItem.svelte';

	let { data } = $props();
</script>

<div class="flex flex-col gap-4">
	<h2 class="text-xl font-bold">Point History</h2>

	<form method="GET" class="flex gap-2">
		<select name="user" class="select select-bordered select-sm flex-1">
			<option value="">All members</option>
			{#each data.members as member (member.id)}
				<option value={member.id} selected={data.filterUser === member.id}>
					{member.display_name}
				</option>
			{/each}
		</select>
		<input
			name="month"
			type="month"
			class="input input-bordered input-sm flex-1"
			value={data.filterMonth ?? ''}
		/>
		<button class="btn btn-primary btn-sm">Filter</button>
	</form>

	{#if data.events.length === 0}
		<p class="text-sm text-base-content/50">No events found.</p>
	{:else}
		<div class="divide-y divide-base-300">
			{#each data.events as event (event.id)}
				<div class="flex items-center gap-2">
					<span class="badge badge-ghost badge-xs">
						{(event as Record<string, unknown>).users
							? ((event as Record<string, unknown>).users as Record<string, unknown>)?.display_name
							: ''}
					</span>
					<div class="flex-1">
						<PointEventItem {event} />
					</div>
				</div>
			{/each}
		</div>
	{/if}

	<a href={resolve('/gamification')} class="btn btn-ghost btn-sm">Back to Dashboard</a>
</div>
