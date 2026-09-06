<script lang="ts">
	import { page } from '$app/state';
	import { pb, displayName, euro, getSettings } from '$lib/pb';
	import BalanceBadge from '$lib/components/BalanceBadge.svelte';
	import type { RecordModel } from 'pocketbase';

	const QUANTITIES = [1, 2, 3, 4, 5, 6, 24];

	let tabUser = $state<RecordModel | null>(null);
	let product = $state<RecordModel | null>(null);
	let qty = $state(0);
	let yellow = $state(0);
	let busy = $state(false);
	let done = $state(false);
	let error = $state('');

	$effect(() => {
		const { user, product: productId } = page.params;
		(async () => {
			yellow = (await getSettings()).yellow_threshold ?? 0;
			tabUser = await pb.collection('users').getOne(user!);
			product = await pb.collection('products').getOne(productId!);
		})();
	});

	const total = $derived(qty * (product?.price ?? 0));
	const newBalance = $derived((tabUser?.balance ?? 0) - total);

	async function confirm() {
		busy = true;
		error = '';
		try {
			await pb.send('/api/bar/order', {
				method: 'POST',
				body: { user: tabUser!.id, product: product!.id, qty }
			});
			done = true;
			setTimeout(() => (location.href = `/tab/${tabUser!.id}`), 2000);
		} catch {
			error = 'Bestelling mislukt, probeer opnieuw.';
			busy = false;
		}
	}
</script>

{#if tabUser && product}
	{#if done}
		<h1>Je bestelling is verwerkt ✔</h1>
		<p>Nieuw saldo: <BalanceBadge balance={newBalance} yellowThreshold={yellow} /></p>
	{:else if !qty}
		<h1>{product.name} — hoeveel?</h1>
		<div class="qty">
			{#each QUANTITIES as n (n)}
				<button onclick={() => (qty = n)}>{n}</button>
			{/each}
		</div>
		<a href="/tab/{tabUser.id}">Annuleren</a>
	{:else}
		<h1>Bevestig bestelling</h1>
		<p class="line">{qty}× {product.name}: <strong>{euro(total)}</strong> in totaal.</p>
		<p>
			Oud: <BalanceBadge balance={tabUser.balance ?? 0} yellowThreshold={yellow} />
			→ Nieuw: <BalanceBadge balance={newBalance} yellowThreshold={yellow} />
		</p>
		<p class="who">op rekening van {displayName(tabUser)}</p>
		<div class="actions">
			<button class="ok" onclick={confirm} disabled={busy}>OK</button>
			<button class="cancel" onclick={() => (qty = 0)} disabled={busy}>Terug</button>
		</div>
		{#if error}<p class="error">{error}</p>{/if}
	{/if}
{/if}

<style>
	.qty {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 0.5rem;
		margin-bottom: 1rem;
	}
	.qty button {
		padding: 1rem 0;
		font-size: 1.3rem;
		font-weight: 700;
		border: none;
		border-radius: 0.6rem;
		background: #fff;
		cursor: pointer;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
	}
	.line {
		font-size: 1.15rem;
	}
	.who {
		color: #5c564e;
	}
	.actions {
		display: flex;
		gap: 0.6rem;
	}
	.actions button {
		flex: 1;
		padding: 1rem;
		font-size: 1.1rem;
		border: none;
		border-radius: 0.6rem;
		cursor: pointer;
	}
	.ok {
		background: #2e7d32;
		color: #fff;
	}
	.cancel {
		background: #ddd;
	}
	.error {
		color: #c62828;
	}
</style>
