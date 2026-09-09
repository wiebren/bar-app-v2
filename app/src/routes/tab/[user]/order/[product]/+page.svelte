<script lang="ts">
	import { page } from '$app/state';
	import { pb, displayName, euro, getSettings, getActiveParties } from '$lib/pb';
	import { BRANDS } from '$lib/brands';
	import BalanceBadge from '$lib/components/BalanceBadge.svelte';
	import BrandMark from '$lib/components/BrandMark.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import type { RecordModel } from 'pocketbase';

	const QUANTITIES = [1, 2, 3, 4, 5];

	let product = $state<RecordModel | null>(null);
	let parties = $state<RecordModel[]>([]);
	let people = $state<RecordModel[]>([]);
	// the account being charged: the tab we came from, until "streep voor"
	// picks someone else — no navigation, so the chosen amount survives
	let target = $state<RecordModel | null>(null);
	let qty = $state(1);
	let letter = $state('');
	let yellow = $state(0);
	let busy = $state(false);
	let done = $state(false);
	let paidByHost = $state('');
	let error = $state('');

	const me = pb.authStore.record;

	$effect(() => {
		const { user, product: productId } = page.params;
		(async () => {
			yellow = (await getSettings()).yellow_threshold ?? 0;
			target = await pb.collection('users').getOne(user!);
			product = await pb.collection('products').getOne(productId!);
			parties = await getActiveParties();
			// accounts that switched off "strepen voor een ander" stay out of the
			// picker; the order hook rejects them too
			people = await pb.collection('users').getFullList({
				filter: 'active = true && block_others != true',
				sort: 'first_name,last_name'
			});
		})();
	});

	const forSelf = $derived(target?.id === me?.id);
	const total = $derived(qty * (product?.price ?? 0));
	const newBalance = $derived((target?.balance ?? 0) - total);
	// party options: not on the host's own tab, and only while the cap allows it
	const partyOffers = $derived(
		target
			? parties.filter((p) => p.host !== target!.id && (!p.cap || (p.used ?? 0) + qty <= p.cap))
			: []
	);

	const others = $derived(people.filter((u) => u.id !== me?.id));
	const letters = $derived([...new Set(others.map((u) => (u.first_name?.[0] ?? '?').toUpperCase()))]);
	const matches = $derived(others.filter((u) => (u.first_name?.[0] ?? '?').toUpperCase() === letter));

	function hostName(party: RecordModel): string {
		return displayName(party.expand?.host ?? {});
	}

	// the name list stays open on the chosen letter, so you can see who is
	// selected and switch again without stepping back through the alphabet
	function pick(u: RecordModel) {
		target = u;
		error = '';
	}

	async function confirm(party: RecordModel | null = null) {
		busy = true;
		error = '';
		try {
			await pb.send('/api/bar/order', {
				method: 'POST',
				body: {
					user: target!.id,
					product: product!.id,
					qty,
					...(party ? { party: party.id } : {})
				}
			});
			paidByHost = party ? hostName(party) : '';
			done = true;
			// "streep voor" is one-time: land back on your OWN tab, not the one just charged
			setTimeout(() => (location.href = `/tab/${me?.id}`), 2000);
		} catch {
			error = 'Bestelling mislukt, probeer opnieuw.';
			busy = false;
		}
	}
</script>

{#if target && product}
	{#if done}
		<div class="donebox">
			<span class="check"><Icon name="check" size={28} /></span>
			<h1>Bestelling verwerkt</h1>
			{#if paidByHost}
				<p>Op rekening van <strong>{paidByHost}</strong> — proost! 🎉</p>
			{:else}
				<p>Nieuw saldo: <BalanceBadge balance={newBalance} yellowThreshold={yellow} /></p>
			{/if}
		</div>
	{:else}
		<h1>Bestellen</h1>

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

		<div class="qtybar" role="group" aria-label="Aantal">
			{#each QUANTITIES as n (n)}
				<button type="button" class:on={qty === n} onclick={() => (qty = n)}>{n}</button>
			{/each}
			<button type="button" class="crate" class:on={qty === 24} onclick={() => (qty = 24)}>
				<Icon name="crate" size={20} /> 24
			</button>
		</div>

		<div class="card">
			<p class="line">
				<span class="item">
					<BrandMark brand={product.brand} height={2} />
					{qty}× {product.name}
				</span>
				<strong>{euro(total)}</strong>
			</p>
			<p class="who">
				op rekening van <strong>{displayName(target)}</strong>
				{#if !forSelf}
					<button class="reset" onclick={() => pick(me!)}>mijn eigen rekening</button>
				{/if}
			</p>
			<div class="balances">
				<span>
					<span class="lbl">Oud</span>
					<BalanceBadge balance={target.balance ?? 0} yellowThreshold={yellow} />
				</span>
				<span class="arrow">→</span>
				<span>
					<span class="lbl">Nieuw</span>
					<BalanceBadge balance={newBalance} yellowThreshold={yellow} />
				</span>
			</div>
		</div>

		{#if partyOffers.length}
			<div class="partybox">
				<div class="actions stacked">
					{#each partyOffers as offer (offer.id)}
						<div class="offer">
							<p class="partyline">
								<span class="gift"><Icon name="gift" size={20} /></span>
								<strong>{hostName(offer)} trakteert{offer.message ? `: ${offer.message}` : '!'}</strong>
							</p>
							<button class="ok" onclick={() => confirm(offer)} disabled={busy}>
								Op rekening van {hostName(offer)}
							</button>
						</div>
					{/each}
					<button class="own" onclick={() => confirm()} disabled={busy}>
						Op rekening van {displayName(target)}
					</button>
					<a class="back" href="/tab/{me?.id}">Annuleren</a>
				</div>
			</div>
		{:else}
			<div class="actions">
				<button class="ok" onclick={() => confirm()} disabled={busy}>Bevestigen</button>
				<a class="back" href="/tab/{me?.id}">Annuleren</a>
			</div>
		{/if}

		{#if error}<p class="error">{error}</p>{/if}

		<section class="foranother">
			<h2>Streep voor iemand anders</h2>
			{#if !letter}
				<div class="letters">
					{#each letters as l (l)}
						<button class="letter" onclick={() => (letter = l)}>{l}</button>
					{/each}
				</div>
			{:else}
				<button class="lettersback" onclick={() => (letter = '')}>
					<Icon name="back" size={18} /> andere letter
				</button>
				<div class="tiles">
					{#each matches as u (u.id)}
						<button class="tile" class:picked={u.id === target.id} onclick={() => pick(u)}>
							<span class="tname">
								{displayName(u)}
								{#if u.id === target.id}
									<span class="tick"><Icon name="check" size={16} /></span>
								{/if}
							</span>
							<BalanceBadge balance={u.balance ?? 0} yellowThreshold={yellow} />
						</button>
					{:else}
						<p>Geen naam met deze letter.</p>
					{/each}
				</div>
			{/if}
		</section>
	{/if}
{/if}

<style>
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
		margin-bottom: 0.7rem;
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
	/* one row, never wrapping: five amounts plus the crate, which gets the
	   extra width its icon + label needs */
	.qtybar {
		display: grid;
		grid-template-columns: repeat(5, 1fr) 1.4fr;
		gap: 0.4rem;
		margin-bottom: 0.9rem;
	}
	.qtybar button {
		padding: 0.7rem 0;
		font-size: 1.15rem;
		font-weight: 700;
		font-family: inherit;
		border: 1px solid var(--line);
		border-radius: var(--radius-s);
		background: var(--surface);
		color: inherit;
		cursor: pointer;
		box-shadow: var(--shadow);
	}
	.qtybar .crate {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.35rem;
		padding-inline: 0.2rem;
		font-size: 1.05rem;
		white-space: nowrap;
	}
	.qtybar button.on {
		background: var(--ink);
		border-color: var(--ink);
		color: var(--surface);
	}
	.qtybar button:active {
		transform: scale(0.95);
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
	.reset {
		border: none;
		background: none;
		padding: 0;
		margin-left: 0.4rem;
		font: inherit;
		color: var(--accent);
		text-decoration: underline;
		cursor: pointer;
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
		margin: 0 0 0.5rem;
	}
	.offer {
		display: flex;
		flex-direction: column;
	}
	.offer .ok {
		width: 100%;
	}
	.offer + .offer {
		margin-top: 0.3rem;
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
	.actions button,
	.actions .back {
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
		display: block;
		text-align: center;
		text-decoration: none;
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
	.foranother {
		margin-top: 1.6rem;
		padding-top: 1.1rem;
		border-top: 1px solid var(--line);
	}
	.foranother h2 {
		font-size: 1rem;
		color: var(--muted);
		margin: 0 0 0.7rem;
	}
	.letters {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(3rem, 1fr));
		gap: 0.5rem;
	}
	.letter {
		aspect-ratio: 1;
		font-size: 1.2rem;
		font-weight: 700;
		font-family: inherit;
		border: 1px solid var(--line);
		border-radius: var(--radius-s);
		background: var(--surface);
		color: inherit;
		cursor: pointer;
		box-shadow: var(--shadow);
	}
	.letter:active {
		transform: scale(0.95);
	}
	.lettersback {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		background: none;
		border: none;
		color: var(--muted);
		font-family: inherit;
		font-size: 0.95rem;
		cursor: pointer;
		padding: 0;
		margin-bottom: 0.7rem;
	}
	.tiles {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.tile {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.6rem;
		width: 100%;
		padding: 0.85rem 1rem;
		font-size: 1.02rem;
		font-family: inherit;
		text-align: left;
		border: 1px solid var(--line);
		border-radius: var(--radius);
		background: var(--surface);
		color: inherit;
		cursor: pointer;
		box-shadow: var(--shadow);
	}
	.tile.picked {
		border-color: var(--ink);
		box-shadow: 0 0 0 1px var(--ink);
		background: color-mix(in srgb, var(--ink) 5%, var(--surface));
	}
	.tname {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		min-width: 0;
	}
	.tick {
		display: inline-flex;
		color: var(--good);
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
