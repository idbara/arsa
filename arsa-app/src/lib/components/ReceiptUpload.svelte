<script lang="ts">
	import { compressImage } from '$lib/compress-image';

	let {
		receiptKey = $bindable('') // eslint-disable-line no-useless-assignment
	}: {
		receiptKey: string;
	} = $props();

	let previewUrl = $state<string | null>(null);
	let uploading = $state(false);
	let error = $state('');

	async function handleFile(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		error = '';
		uploading = true;

		try {
			previewUrl = URL.createObjectURL(file);

			const compressed = await compressImage(file);

			const presignRes = await fetch('/api/receipts/presign', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ contentType: 'image/jpeg' })
			});

			if (!presignRes.ok) {
				throw new Error('Failed to get upload URL');
			}

			const { putUrl, key } = await presignRes.json();

			const uploadRes = await fetch(putUrl, {
				method: 'PUT',
				headers: { 'Content-Type': 'image/jpeg' },
				body: compressed
			});

			if (!uploadRes.ok) {
				throw new Error('Upload failed');
			}

			receiptKey = key;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Upload failed';
			previewUrl = null;
			receiptKey = '';
		} finally {
			uploading = false;
		}
	}

	function removeReceipt() {
		previewUrl = null;
		receiptKey = '';
	}
</script>

<div class="flex flex-col gap-2">
	{#if previewUrl}
		<div class="relative">
			<img src={previewUrl} alt="Receipt preview" class="h-32 w-auto rounded-lg object-cover" />
			<button
				class="btn btn-circle btn-error btn-xs absolute -right-2 -top-2"
				onclick={removeReceipt}>x</button
			>
			{#if uploading}
				<div class="absolute inset-0 flex items-center justify-center rounded-lg bg-base-300/70">
					<span class="loading loading-spinner loading-md"></span>
				</div>
			{/if}
		</div>
	{:else}
		<label class="btn btn-ghost btn-sm gap-2">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="size-4"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M3 9a2 2 0 0 1 2-2h.93a2 2 0 0 0 1.664-.89l.812-1.22A2 2 0 0 1 10.07 4h3.86a2 2 0 0 1 1.664.89l.812 1.22A2 2 0 0 0 18.07 7H19a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9z"
				/>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M15 13a3 3 0 1 1-6 0 3 3 0 0 1 6 0z"
				/>
			</svg>
			Attach Receipt
			<input
				type="file"
				accept="image/*"
				capture="environment"
				class="hidden"
				onchange={handleFile}
			/>
		</label>
	{/if}

	{#if error}
		<p class="text-xs text-error">{error}</p>
	{/if}
</div>
