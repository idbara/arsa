<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { FREQUENCY_OPTIONS } from '$lib/types/subscription';

	let { data, form } = $props();
	let showDeleteConfirm = $state(false);
</script>

<h1 class="heading-xl mb-6">Edit Langganan</h1>

{#if form?.error}
	<div class="animate-fade-in mb-4 rounded-xl bg-error/10 px-4 py-2.5 text-sm text-error">
		{form.error}
	</div>
{/if}

<form method="POST" action="?/update" use:enhance class="flex flex-col gap-4">
	<label class="floating-label">
		<span>Nama Layanan</span>
		<input
			name="name"
			type="text"
			placeholder="Nama Layanan"
			class="input input-bordered w-full rounded-xl"
			value={data.subscription.name}
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
			value={data.subscription.amount}
			step="any"
			min="0"
			required
		/>
	</label>

	<label class="form-control w-full">
		<div class="label"><span class="text-sm font-medium">Frekuensi</span></div>
		<select name="frequency" class="select select-bordered w-full rounded-xl" required>
			{#each FREQUENCY_OPTIONS as opt (opt.value)}
				<option value={opt.value} selected={data.subscription.frequency === opt.value}>
					{opt.label}
				</option>
			{/each}
		</select>
	</label>

	<label class="form-control w-full">
		<div class="label"><span class="text-sm font-medium">Kategori</span></div>
		<select name="category_id" class="select select-bordered w-full rounded-xl">
			<option value="">Tanpa kategori</option>
			{#each data.categories as cat (cat.id)}
				<option value={cat.id} selected={data.subscription.category_id === cat.id}>
					{cat.name}
				</option>
			{/each}
		</select>
	</label>

	<label class="form-control w-full">
		<div class="label"><span class="text-sm font-medium">Akun Pembayaran</span></div>
		<select name="account_id" class="select select-bordered w-full rounded-xl">
			<option value="">Tidak ditentukan</option>
			{#each data.accounts as acct (acct.id)}
				<option value={acct.id} selected={data.subscription.account_id === acct.id}>
					{acct.name}
				</option>
			{/each}
		</select>
	</label>

	<label class="floating-label">
		<span>Tanggal Mulai</span>
		<input
			name="start_date"
			type="date"
			class="input input-bordered w-full rounded-xl"
			value={data.subscription.start_date}
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
			value={data.subscription.notes ?? ''}
		/>
	</label>

	<div class="form-control">
		<label class="label cursor-pointer justify-start gap-3">
			<input
				name="is_active"
				type="checkbox"
				class="toggle toggle-primary"
				checked={data.subscription.is_active}
			/>
			<span class="text-sm font-medium">Aktif</span>
		</label>
	</div>

	<p class="text-subtle text-xs">
		Jatuh tempo berikutnya: {data.subscription.next_due_date}
	</p>

	<div class="flex gap-2">
		<a href={resolve('/plan/subscriptions')} class="btn btn-ghost flex-1 rounded-xl">Batal</a>
		<button type="submit" class="btn btn-primary flex-1 rounded-xl">Simpan</button>
	</div>
</form>

<div class="divider"></div>

<button
	class="btn btn-error btn-outline w-full rounded-xl"
	onclick={() => (showDeleteConfirm = true)}
>
	Hapus Langganan
</button>

{#if showDeleteConfirm}
	<div class="modal modal-open">
		<div class="modal-box rounded-2xl">
			<h3 class="heading-lg">Hapus "{data.subscription.name}"?</h3>
			<p class="text-subtle py-4">Tindakan ini tidak dapat dibatalkan.</p>
			<div class="modal-action">
				<button class="btn btn-ghost rounded-xl" onclick={() => (showDeleteConfirm = false)}>
					Batal
				</button>
				<form method="POST" action="?/delete" use:enhance>
					<button type="submit" class="btn btn-error rounded-xl">Hapus</button>
				</form>
			</div>
		</div>
		<button
			class="modal-backdrop bg-black/30"
			aria-label="Close"
			onclick={() => (showDeleteConfirm = false)}
		></button>
	</div>
{/if}
