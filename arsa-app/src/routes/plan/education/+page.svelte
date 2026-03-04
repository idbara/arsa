<script lang="ts">
	import { resolve } from '$app/paths';

	interface EducationLevel {
		label: string;
		entryAge: number;
		exitAge: number;
	}

	const levels: EducationLevel[] = [
		{ label: 'TK (Kindergarten)', entryAge: 5, exitAge: 6 },
		{ label: 'SD (Elementary)', entryAge: 7, exitAge: 12 },
		{ label: 'SMP (Junior High)', entryAge: 13, exitAge: 15 },
		{ label: 'SMA (Senior High)', entryAge: 16, exitAge: 18 },
		{ label: 'Kuliah (University)', entryAge: 19, exitAge: 22 }
	];

	let childAge = $state(1);
	let inflationRate = $state(6);

	let costs = $state<Record<string, number>>({
		TK: 15000000,
		SD: 20000000,
		SMP: 25000000,
		SMA: 30000000,
		Kuliah: 50000000
	});

	const costKeys = ['TK', 'SD', 'SMP', 'SMA', 'Kuliah'];

	let projections = $derived(
		levels.map((level, i) => {
			const yearsUntil = level.entryAge - childAge;
			const currentCost = costs[costKeys[i]] ?? 0;
			const rate = inflationRate / 100;

			if (yearsUntil <= 0) {
				return {
					label: level.label,
					entryAge: level.entryAge,
					yearsUntil: 0,
					currentCost,
					projectedCost: currentCost,
					passed: true
				};
			}

			const projectedCost = Math.round(currentCost * Math.pow(1 + rate, yearsUntil));

			return {
				label: level.label,
				entryAge: level.entryAge,
				yearsUntil,
				currentCost,
				projectedCost,
				passed: false
			};
		})
	);

	let activeProjections = $derived(projections.filter((p) => !p.passed));

	let totalProjected = $derived(activeProjections.reduce((sum, p) => sum + p.projectedCost, 0));
</script>

<h1 class="mb-6 text-2xl font-bold">Education Cost Projection</h1>

<div class="mb-6 flex flex-col gap-4">
	<label class="floating-label">
		<span>Child's Current Age</span>
		<input
			type="number"
			inputmode="numeric"
			placeholder="Child's Current Age"
			class="input input-bordered w-full"
			bind:value={childAge}
			min="0"
			max="25"
		/>
	</label>

	<label class="floating-label">
		<span>Inflation Rate (%)</span>
		<input
			type="number"
			inputmode="decimal"
			placeholder="Inflation Rate (%)"
			class="input input-bordered w-full"
			bind:value={inflationRate}
			step="0.1"
			min="0"
			max="30"
		/>
	</label>
</div>

<h2 class="mb-3 text-lg font-bold">Current Annual Costs</h2>
<div class="mb-6 flex flex-col gap-3">
	{#each levels as level, i (level.label)}
		<label class="floating-label">
			<span>{level.label}</span>
			<input
				type="number"
				inputmode="decimal"
				placeholder={level.label}
				class="input input-bordered w-full"
				bind:value={costs[costKeys[i]]}
				step="any"
			/>
		</label>
	{/each}
</div>

<h2 class="mb-3 text-lg font-bold">Projected Costs</h2>

{#if activeProjections.length === 0}
	<p class="py-4 text-center text-base-content/60">Child has passed all education levels.</p>
{:else}
	<div class="mb-4 overflow-x-auto">
		<table class="table table-sm">
			<thead>
				<tr>
					<th>Level</th>
					<th class="text-right">Entry Age</th>
					<th class="text-right">In Years</th>
					<th class="text-right">Projected Cost</th>
				</tr>
			</thead>
			<tbody>
				{#each activeProjections as row (row.label)}
					<tr>
						<td class="font-medium">{row.label}</td>
						<td class="text-right">{row.entryAge}</td>
						<td class="text-right">{row.yearsUntil}</td>
						<td class="text-right font-mono">
							Rp {row.projectedCost.toLocaleString('id-ID')}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<div class="stats w-full shadow">
		<div class="stat">
			<div class="stat-title">Total Projected Cost</div>
			<div class="stat-value text-2xl text-primary">
				Rp {totalProjected.toLocaleString('id-ID')}
			</div>
			<div class="stat-desc">At {inflationRate}% annual inflation</div>
		</div>
	</div>
{/if}

<div class="mt-6">
	<a href={resolve('/plan')} class="btn btn-ghost w-full">Back to Plan</a>
</div>
