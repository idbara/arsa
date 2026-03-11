<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { FREQUENCY_OPTIONS } from '$lib/types/subscription';

	let { data, form } = $props();

	const today = new Date().toISOString().split('T')[0];
</script>

<h1 class="heading-xl mb-6">Tambah Langganan</h1>

{#if form?.error}
	<div class="animate-fade-in mb-4 rounded-xl bg-error/10 px-4 py-2.5 text-sm text-error">
		{form.error}
	</div>
{/if}

<form method="POST" use:enhance class="flex flex-col gap-4">
	<label class="floating-label">
		<span>Nama Layanan</span>
		<input
			name="name"
			type="text"
			placeholder="Nama Layanan"
			class="input input-bordered w-full rounded-xl"
			value={form?.name ?? ''}
			required
		/>
	</label>

	<label class="floating-label">
		<span>Jumlah (Rp)</span>
		<input
			name="amount"
			type="number"
			inputmode="decimal"
			placeholder="Jumlah (Rp)"
			class="input input-bordered w-full rounded-xl"
			value={form?.amount ?? ''}
			step="any"
			min="0"
			required
		/>
	</label>

	<label class="form-control w-full">
		<div class="label"><span class="text-sm font-medium">Frekuensi</span></div>
		<select name="frequency" class="select select-bordered w-full rounded-xl" required>
			<option value="" disabled selected={!form?.frequency}>Pilih frekuensi</option>
			{#each FREQUENCY_OPTIONS as opt (opt.value)}
				<option value={opt.value} selected={form?.frequency === opt.value}>{opt.label}</option>
			{/each}
		</select>
	</label>

	<label class="form-control w-full">
		<div class="label"><span class="text-sm font-medium">Kategori</span></div>
		<select name="category_id" class="select select-bordered w-full rounded-xl">
			<option value="">Tanpa kategori</option>
			{#each data.categories as cat (cat.id)}
				<option value={cat.id} selected={form?.category_id === cat.id}>{cat.name}</option>
			{/each}
		</select>
	</label>

	<label class="form-control w-full">
		<div class="label"><span class="text-sm font-medium">Akun Pembayaran</span></div>
		<select name="account_id" class="select select-bordered w-full rounded-xl">
			<option value="">Tidak ditentukan</option>
			{#each data.accounts as acct (acct.id)}
				<option value={acct.id} selected={form?.account_id === acct.id}>{acct.name}</option>
			{/each}
		</select>
	</label>

	<label class="floating-label">
		<span>Tanggal Mulai</span>
		<input
			name="start_date"
			type="date"
			class="input input-bordered w-full rounded-xl"
			value={form?.start_date ?? today}
			required
		/>
	</label>

	<label class="floating-label">
		<span>Catatan</span>
		<input
			name="notes"
			type="text"
			placeholder="Catatan"
			class="input input-bordered w-full rounded-xl"
			value={form?.notes ?? ''}
		/>
	</label>

	<div class="flex gap-2">
		<a href={resolve('/plan/subscriptions')} class="btn btn-ghost flex-1 rounded-xl">Batal</a>
		<button type="submit" class="btn btn-primary flex-1 rounded-xl">Simpan</button>
	</div>
</form>
