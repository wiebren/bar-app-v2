<script lang="ts">
	import { page } from '$app/state';
	import { pb, displayName, euro, getSettings } from '$lib/pb';
	import BalanceBadge from '$lib/components/BalanceBadge.svelte';
	import Icon from '$lib/components/Icon.svelte';
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
		<div class="donebox">
			<span class="check"><Icon name="check" size={28} /></span>
			<h1>Bestelling verwerkt</h1>
			<p>Nieuw saldo: <BalanceBadge balance={newBalance} yellowThreshold={yellow} /></p>
		</div>
	{:else if !qty}
		<h1>{product.name} — hoeveel?</h1>
		<div class="qty">
			{#each QUANTITIES as n (n)}
				<button onclick={() => (qty = n)}>{n}</button>
			{/each}
		</div>
		<a class="cancel" href="/tab/{tabUser.id}">Annuleren</a>
	{:else}
		<h1>Bevestig bestelling</h1>
		<div class="card">
			<p class="line">
				{qty}× {product.name}
				<strong>{euro(total)}</strong>
			</p>
			<p class="who">op rekening van {displayName(tabUser)}</p>
			<div class="balances">
				<span>
					<span class="lbl">Oud</span>
					<BalanceBadge balance={tabUser.balance ?? 0} yellowThreshold={yellow} />
				</span>
				<span class="arrow">→</span>
				<span>
					<span class="lbl">Nieuw</span>
					<BalanceBadge balance={newBalance} yellowThreshold={yellow} />
				</span>
			</div>
		</div>
		<div class="actions">
			<button class="ok" onclick={confirm} disabled={busy}>Bevestigen</button>
			<button class="back" onclick={() => (qty = 0)} disabled={busy}>Terug</button>
		</div>
		{#if error}<p class="error">{error}</p>{/if}
	{/if}
{/if}

<style>
	.qty {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 0.6rem;
		margin-bottom: 1.2rem;
	}
	.qty button {
		aspect-ratio: 1.15;
		font-size: 1.4rem;
		font-weight: 700;
		font-family: inherit;
		border: 1px solid var(--line);
		border-radius: var(--radius);
		background: var(--surface);
		color: inherit;
		cursor: pointer;
		box-shadow: var(--shadow);
	}
	.qty button:active {
		transform: scale(0.95);
	}
	.cancel {
		color: var(--muted);
	}
	.card {
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: var(--radius);
		box-shadow: var(--shadow);
		padding: 1.1rem 1.2rem;
		margin-bottom: 1rem;
	}
	.line {
		display: flex;
		justify-content: space-between;
		font-size: 1.15rem;
		margin: 0;
	}
	.who {
		color: var(--muted);
		margin: 0.2rem 0 0.9rem;
		font-size: 0.92rem;
	}
	.balances {
		display: flex;
		align-items: center;
		gap: 0.8rem;
	}
	.balances > span {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
	}
	.lbl {
		font-size: 0.8rem;
		color: var(--muted);
	}
	.arrow {
		color: var(--muted);
	}
	.actions {
		display: flex;
		gap: 0.6rem;
	}
	.actions button {
		flex: 1;
		padding: 0.95rem;
		font-size: 1.05rem;
		font-weight: 600;
		font-family: inherit;
		border: none;
		border-radius: var(--radius-s);
		cursor: pointer;
	}
	.ok {
		background: var(--good);
		color: #fff;
	}
	.back {
		background: var(--surface);
		border: 1px solid var(--line) !important;
		color: inherit;
	}
	.actions button:disabled {
		opacity: 0.5;
	}
	.error {
		color: var(--bad);
	}
	.donebox {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		padding-top: 3rem;
		gap: 0.4rem;
	}
	.check {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 3.4rem;
		height: 3.4rem;
		border-radius: 999px;
		background: color-mix(in srgb, var(--good) 14%, transparent);
		color: var(--good);
	}
</style>
