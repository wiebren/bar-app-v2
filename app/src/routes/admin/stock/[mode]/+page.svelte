<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { pb } from '$lib/pb';
	import { BRANDS } from '$lib/brands';
	import BrandMark from '$lib/components/BrandMark.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import type { RecordModel } from 'pocketbase';

	const UNITS = [
		{ label: 'Los flesje', size: 1 },
		{ label: 'Sixpack', size: 6 },
		{ label: 'Krat', size: 24 }
	] as const;

	const isCount = $derived(page.params.mode === 'count');
	const title = $derived(isCount ? 'Voorraad tellen' : 'Inkoop boeken');

	let products = $state<RecordModel[]>([]);
	let product = $state<RecordModel | null>(null);
	let currentStock = $state<number | null>(null);
	let counts = $state([0, 0, 0]);
	let busy = $state(false);
	let error = $state('');
	// after submit: the booked result, shown on the confirmation screen
	let result = $state<{ newStock: number; delta: number } | null>(null);

	$effect(() => {
		if (page.params.mode !== 'add' && page.params.mode !== 'count') {
			goto('/admin');
			return;
		}
		// ?product=… (from the product edit screen) skips the picker
		const preselect = page.url.searchParams.get('product');
		(async () => {
			products = await pb.collection('products').getFullList({
				filter: 'stock_tracked = true',
				sort: 'sort_order,name'
			});
			const match = preselect && products.find((p) => p.id === preselect);
			if (match && !product) pick(match);
		})();
	});

	// (n || 0): an emptied number input binds null, which must not poison the total
	const total = $derived(counts.reduce((sum, n, i) => sum + (n || 0) * UNITS[i].size, 0));

	async function pick(p: RecordModel) {
		product = p;
		currentStock = null;
		counts = [0, 0, 0];
		error = '';
		const entries = await pb.collection('stock_entries').getFullList({
			filter: `product = "${p.id}"`,
			fields: 'qty'
		});
		currentStock = entries.reduce((sum, s) => sum + (s.qty ?? 0), 0);
	}

	function backToProducts() {
		product = null;
		currentStock = null;
		counts = [0, 0, 0];
		result = null;
		error = '';
	}

	async function submit() {
		busy = true;
		error = '';
		try {
			if (isCount) {
				const res = await pb.send('/api/bar/stock-count', {
					method: 'POST',
					body: { product: product!.id, counted: total }
				});
				result = { newStock: res.counted, delta: res.delta };
			} else {
				await pb.collection('stock_entries').create({
					type: 'purchase',
					product: product!.id,
					qty: total,
					date: new Date().toISOString(),
					actor: pb.authStore.record!.id
				});
				result = { newStock: (currentStock ?? 0) + total, delta: total };
			}
		} catch {
			error = isCount ? 'Telling verwerken mislukt.' : 'Inboeken mislukt.';
		}
		busy = false;
	}
</script>

{#if result && product}
	<div class="donebox">
		<span class="check"><Icon name="check" size={28} /></span>
		<h1>{isCount ? 'Telling verwerkt' : 'Inkoop geboekt'}</h1>
		<p class="doneline">
			<BrandMark brand={product.brand} height={2} />
			{product.name}
		</p>
		<p class="newstock">
			Nieuwe voorraad: <strong>{result.newStock}</strong>
			{#if isCount}
				<span class="delta">(correctie {result.delta > 0 ? '+' : ''}{result.delta})</span>
			{:else}
				<span class="delta">(+{result.delta})</span>
			{/if}
		</p>
		<div class="actions">
			<button class="ok" onclick={backToProducts}>Volgend product</button>
			<a class="back" href="/admin">Terug</a>
		</div>
	</div>
{:else if !product}
	<h1>{title}</h1>
	<p class="hint">Kies een product</p>
	<div class="products">
		{#each products as p (p.id)}
			{@const brand = BRANDS[p.brand]}
			<button
				class="product"
				onclick={() => pick(p)}
				style:border-left={brand ? `5px solid ${brand.color}` : undefined}
			>
				<span class="name">{p.name}</span>
				<BrandMark brand={p.brand} />
			</button>
		{/each}
	</div>
	<a class="cancelbtn" href="/admin">Annuleren</a>
{:else}
	<h1>{title}</h1>
	<div
		class="productcard"
		style:border-left={BRANDS[product.brand]
			? `5px solid ${BRANDS[product.brand].color}`
			: undefined}
	>
		<span class="ptext">
			<span class="pname">{product.name}</span>
			<span class="pstock">
				{#if currentStock === null}
					voorraad laden…
				{:else if isCount}
					er zou <strong>{currentStock}</strong> op voorraad moeten zijn
				{:else}
					huidige voorraad: <strong>{currentStock}</strong>
				{/if}
			</span>
		</span>
		<BrandMark brand={product.brand} />
	</div>

	<div class="steppers">
		{#each UNITS as unit, i (unit.label)}
			<div class="stepper">
				<span class="unitlabel">
					{unit.label}
					{#if unit.size > 1}<span class="unitsize">× {unit.size}</span>{/if}
				</span>
				<button
					class="step"
					aria-label="minder {unit.label}"
					disabled={!counts[i]}
					onclick={() => (counts[i] = Math.max(0, (counts[i] || 0) - 1))}>−</button
				>
				<input type="number" bind:value={counts[i]} min="0" step="1" />
				<button
					class="step"
					aria-label="meer {unit.label}"
					onclick={() => (counts[i] = (counts[i] || 0) + 1)}>+</button
				>
			</div>
		{/each}
	</div>

	<p class="totalline">Totaal: <strong>{total}</strong> flesjes</p>

	{#if error}<p class="error">{error}</p>{/if}
	<div class="actions">
		<button class="ok" onclick={submit} disabled={busy || (!isCount && total < 1)}>
			{isCount ? 'Verwerk telling' : 'Boek inkoop'}
		</button>
		<button class="back" onclick={backToProducts} disabled={busy}>Terug</button>
	</div>
{/if}

<style>
	.hint {
		color: var(--muted);
		margin: -0.4rem 0 0.8rem;
	}
	.products {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 0.6rem;
		margin-bottom: 1rem;
	}
	.product {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.5rem;
		padding: 0.9rem 1rem;
		font-family: inherit;
		font-size: 1rem;
		text-align: left;
		border: 1px solid var(--line);
		border-radius: var(--radius);
		background: var(--surface);
		color: inherit;
		box-shadow: var(--shadow);
		cursor: pointer;
		transition: transform 0.08s ease;
	}
	.product:active {
		transform: scale(0.97);
	}
	.name {
		font-weight: 600;
		font-size: 1.02rem;
		min-width: 0;
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
	.pstock {
		color: var(--muted);
		font-size: 0.92rem;
	}
	.steppers {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		margin-bottom: 1rem;
	}
	.stepper {
		display: grid;
		grid-template-columns: 1fr auto auto auto;
		align-items: center;
		gap: 0.6rem;
		padding: 0.6rem 0.8rem;
		border: 1px solid var(--line);
		border-radius: var(--radius);
		background: var(--surface);
		box-shadow: var(--shadow);
	}
	.unitlabel {
		font-weight: 600;
	}
	.unitsize {
		color: var(--muted);
		font-weight: 400;
		font-size: 0.85rem;
		margin-left: 0.25rem;
	}
	.step {
		width: 3rem;
		height: 3rem;
		font-size: 1.5rem;
		font-weight: 700;
		font-family: inherit;
		line-height: 1;
		border: 1px solid var(--line);
		border-radius: var(--radius-s);
		background: var(--surface);
		color: inherit;
		cursor: pointer;
	}
	.step:active:not(:disabled) {
		transform: scale(0.95);
	}
	.step:disabled {
		opacity: 0.35;
		cursor: default;
	}
	.stepper input {
		width: 3.6rem;
		height: 3rem;
		text-align: center;
		font-size: 1.2rem;
		font-weight: 700;
		font-family: inherit;
		font-variant-numeric: tabular-nums;
		border: 1px solid var(--line);
		border-radius: var(--radius-s);
		background: var(--surface);
		color: inherit;
	}
	.totalline {
		font-size: 1.1rem;
		margin: 0 0 1rem;
	}
	.totalline strong {
		font-variant-numeric: tabular-nums;
	}
	.actions {
		display: flex;
		gap: 0.6rem;
		width: 100%;
	}
	.actions .ok,
	.actions .back {
		flex: 1;
		padding: 0.95rem;
		font-size: 1.05rem;
		font-weight: 600;
		font-family: inherit;
		text-align: center;
		text-decoration: none;
		border: none;
		border-radius: var(--radius-s);
		cursor: pointer;
	}
	.ok {
		background: var(--good);
		color: #fff;
	}
	.ok:disabled {
		opacity: 0.5;
	}
	.back {
		background: var(--surface);
		border: 1px solid var(--line) !important;
		color: inherit;
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
		box-sizing: border-box;
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
	.doneline {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 1.1rem;
		font-weight: 600;
		margin: 0;
	}
	.newstock {
		margin: 0 0 1rem;
	}
	.newstock strong {
		font-variant-numeric: tabular-nums;
	}
	.delta {
		color: var(--muted);
	}
	.donebox .actions {
		max-width: 24rem;
	}
</style>
