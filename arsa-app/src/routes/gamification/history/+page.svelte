<script lang="ts">
	import { resolve } from '$app/paths';
	import PointEventItem from '$lib/components/PointEventItem.svelte';

	let { data } = $props();
</script>

<div class="flex flex-col gap-4">
	<h2 class="heading-xl">Point History</h2>

	<form method="GET" class="flex gap-2">
		<select name="user" class="select select-bordered select-sm flex-1 rounded-lg">
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
			class="input input-bordered input-sm flex-1 rounded-lg"
			value={data.filterMonth ?? ''}
		/>
		<button class="btn btn-primary btn-sm rounded-lg">Filter</button>
	</form>

	{#if data.events.length === 0}
		<p class="text-subtle text-sm">No events found.</p>
	{:else}
		<div class="divide-y divide-base-200">
			{#each data.events as event (event.id)}
				<div class="flex items-center gap-2">
					<span class="text-subtle rounded-full bg-base-200/50 px-2 py-0.5 text-[10px] font-medium">
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

	<a href={resolve('/gamification')} class="btn btn-ghost btn-sm rounded-xl">Back to Dashboard</a>
</div>
