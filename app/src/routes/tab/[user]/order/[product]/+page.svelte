<script lang="ts">
	import { page } from '$app/state';
	import { pb, displayName, euro, getSettings, getActiveParty } from '$lib/pb';
	import { BRANDS } from '$lib/brands';
	import BalanceBadge from '$lib/components/BalanceBadge.svelte';
	import BrandMark from '$lib/components/BrandMark.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import type { RecordModel } from 'pocketbase';

	const QUANTITIES = [1, 2, 3, 4, 5, 6];

	let tabUser = $state<RecordModel | null>(null);
	let product = $state<RecordModel | null>(null);
	let party = $state<RecordModel | null>(null);
	let qty = $state(0);
	let yellow = $state(0);
	let busy = $state(false);
	let done = $state(false);
	let paidByParty = $state(false);
	let error = $state('');

	$effect(() => {
		const { user, product: productId } = page.params;
		(async () => {
			yellow = (await getSettings()).yellow_threshold ?? 0;
			tabUser = await pb.collection('users').getOne(user!);
			product = await pb.collection('products').getOne(productId!);
			party = await getActiveParty();
		})();
	});

	const total = $derived(qty * (product?.price ?? 0));
	const newBalance = $derived((tabUser?.balance ?? 0) - total);
	// party option: not on the host's own tab, and only while the cap allows it
	const partyOffer = $derived(
		party && tabUser && party.host !== tabUser.id && (!party.cap || (party.used ?? 0) + qty <= party.cap)
			? party
			: null
	);
	const partyHostName = $derived(partyOffer ? displayName(partyOffer.expand?.host ?? {}) : '');

	async function confirm(asParty = false) {
		busy = true;
		error = '';
		try {
			await pb.send('/api/bar/order', {
				method: 'POST',
				body: {
					user: tabUser!.id,
					product: product!.id,
					qty,
					...(asParty ? { party: party!.id } : {})
				}
			});
			paidByParty = asParty;
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
			{#if paidByParty}
				<p>Op rekening van <strong>{partyHostName}</strong> — proost! 🎉</p>
			{:else}
				<p>Nieuw saldo: <BalanceBadge balance={newBalance} yellowThreshold={yellow} /></p>
			{/if}
		</div>
	{:else if !qty}
		<h1>Hoeveel?</h1>
		<div
			class="productcard"
			style:border-left={BRANDS[product.brand]
				? `5px solid ${BRANDS[product.brand].color}`
				: undefined}
		>
			<span class="ptext">
				<span class="pname">{product.name}</span>
				<span class="pprice">{euro(product.price)}</span>
			</span>
			<BrandMark brand={product.brand} />
		</div>
		<div class="qty">
			{#each QUANTITIES as n (n)}
				<button onclick={() => (qty = n)}>{n}</button>
			{/each}
			<button class="crate" onclick={() => (qty = 24)}>
				<Icon name="crate" size={26} /> 24
			</button>
		</div>
		<a class="cancelbtn" href="/tab/{tabUser.id}">Annuleren</a>
	{:else}
		<h1>Bevestig bestelling</h1>
		<div class="card">
			<p class="line">
				<span class="item">
					<BrandMark brand={product.brand} height={2} />
					{qty}× {product.name}
				</span>
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
		{#if partyOffer}
			<div class="partybox">
				<p class="partyline">
					<span class="gift"><Icon name="gift" size={20} /></span>
					<strong>{partyHostName} trakteert{partyOffer.message ? `: ${partyOffer.message}` : '!'}</strong>
				</p>
				<div class="actions stacked">
					<button class="ok" onclick={() => confirm(true)} disabled={busy}>
						Op rekening van {partyHostName}
					</button>
					<button class="own" onclick={() => confirm(false)} disabled={busy}>
						Op eigen rekening
					</button>
					<button class="back" onclick={() => (qty = 0)} disabled={busy}>Terug</button>
				</div>
			</div>
		{:else}
			<div class="actions">
				<button class="ok" onclick={() => confirm(false)} disabled={busy}>Bevestigen</button>
				<button class="back" onclick={() => (qty = 0)} disabled={busy}>Terug</button>
			</div>
		{/if}
		{#if error}<p class="error">{error}</p>{/if}
	{/if}
{/if}

<style>
	.qty {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.6rem;
		margin-bottom: 1.2rem;
	}
	.qty button {
		aspect-ratio: 1.6;
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
	.qty .crate {
		grid-column: 1 / -1;
		aspect-ratio: auto;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.6rem;
		padding: 1rem 0;
	}
	.qty button:active {
		transform: scale(0.95);
	}
	.productcard {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.6rem;
		padding: 0.9rem 1rem;
		border: 1px solid var(--line);
		border-radius: var(--radius);
		background: var(--surface);
		box-shadow: var(--shadow);
		margin-bottom: 1rem;
	}
	.ptext {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		min-width: 0;
	}
	.pname {
		font-weight: 600;
		font-size: 1.1rem;
	}
	.pprice {
		color: var(--accent);
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}
	.cancelbtn {
		display: block;
		width: 100%;
		padding: 0.95rem;
		font-size: 1.05rem;
		font-weight: 600;
		text-align: center;
		text-decoration: none;
		border: 1px solid var(--line);
		border-radius: var(--radius-s);
		background: var(--surface);
		color: inherit;
		box-shadow: var(--shadow);
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
		align-items: center;
		gap: 0.5rem;
		font-size: 1.15rem;
		margin: 0;
	}
	.item {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
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
	.partybox {
		border: 1px solid color-mix(in srgb, var(--accent) 35%, transparent);
		background: color-mix(in srgb, var(--accent) 7%, var(--surface));
		border-radius: var(--radius);
		padding: 0.9rem 1rem;
	}
	.partyline {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin: 0 0 0.8rem;
	}
	.gift {
		display: inline-flex;
		color: var(--accent);
		flex-shrink: 0;
	}
	.actions {
		display: flex;
		gap: 0.6rem;
	}
	.actions.stacked {
		flex-direction: column;
	}
	.own {
		background: var(--surface);
		border: 1px solid var(--line) !important;
		color: inherit;
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
