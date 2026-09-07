<script lang="ts">
	import { pb, displayName } from '$lib/pb';
	import { downloadCsv } from '$lib/csv';
	import Icon from '$lib/components/Icon.svelte';
	import type { RecordModel } from 'pocketbase';

	let products = $state<RecordModel[]>([]);

	// report
	let from = $state(new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10));
	let to = $state(new Date().toISOString().slice(0, 10));
	let report = $state<
		{ name: string; begin: number; purchases: number; sales: number; counts: number; end: number }[]
	>([]);
	// transactions
	let txProduct = $state('');
	let transactions = $state<RecordModel[]>([]);

	$effect(() => {
		(async () => {
			products = await pb.collection('products').getFullList({ sort: 'sort_order,name' });
		})();
	});

	async function runReport(e?: SubmitEvent) {
		e?.preventDefault();
		const entries = await pb.collection('stock_entries').getFullList({
			fields: 'product,type,qty,date'
		});
		const fromTs = `${from} 00:00:00`;
		const toTs = `${to} 23:59:59`;
		report = products
			.filter((p) => p.stock_tracked)
			.map((p) => {
				const mine = entries.filter((s) => s.product === p.id);
				const inRange = mine.filter((s) => s.date >= fromTs && s.date <= toTs);
				const sum = (rows: RecordModel[], type?: string) =>
					rows.filter((s) => !type || s.type === type).reduce((a, s) => a + (s.qty ?? 0), 0);
				return {
					name: p.name,
					begin: sum(mine.filter((s) => s.date < fromTs)),
					purchases: sum(inRange, 'purchase'),
					sales: -sum(inRange, 'sale'),
					counts: sum(inRange, 'count'),
					end: sum(mine.filter((s) => s.date <= toTs))
				};
			});
	}

	async function loadTransactions() {
		transactions = await pb.collection('stock_entries').getFullList({
			filter: `product = "${txProduct}"`,
			sort: '-date',
			expand: 'actor'
		});
	}

	function exportReport() {
		downloadCsv(`voorraad-${from}-${to}.csv`, [
			['Product', 'Beginstand', 'Inkoop', 'Verkoop', 'Correcties', 'Eindstand'],
			...report.map((r) => [r.name, r.begin, r.purchases, r.sales, r.counts, r.end])
		]);
	}

	const typeLabel: Record<string, string> = { purchase: 'inkoop', sale: 'verkoop', count: 'telling' };
</script>

<h1>Voorraad</h1>

<div class="wizards">
	<a class="wizard" href="/admin/stock/add">
		<Icon name="plus" size={26} />
		Inkoop boeken
	</a>
	<a class="wizard" href="/admin/stock/count">
		<Icon name="crate" size={26} />
		Voorraad tellen
	</a>
</div>

<h2>Voorraadrapport</h2>
<form class="panel" onsubmit={runReport}>
	<div class="row">
		<label>Van<input type="date" bind:value={from} required /></label>
		<label>Tot en met<input type="date" bind:value={to} required /></label>
	</div>
	<div class="row">
		<button class="btn">Toon</button>
		<button class="btn" type="button" onclick={exportReport} disabled={!report.length}>CSV</button>
	</div>
</form>
{#if report.length}
	<div class="tablewrap">
		<table>
			<thead>
				<tr>
					<th>Product</th><th class="num">Begin</th><th class="num">In</th>
					<th class="num">Uit</th><th class="num">Corr.</th><th class="num">Eind</th>
				</tr>
			</thead>
			<tbody>
				{#each report as r (r.name)}
					<tr>
						<td>{r.name}</td><td class="num light">{r.begin}</td><td class="num light">{r.purchases}</td>
						<td class="num light">{r.sales}</td><td class="num light">{r.counts}</td><td class="num">{r.end}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}

<h2>Transacties per product</h2>
<div class="panel">
	<label>Product
		<select bind:value={txProduct} onchange={loadTransactions}>
			<option value="" disabled>kies…</option>
			{#each products as p (p.id)}
				<option value={p.id}>{p.name}</option>
			{/each}
		</select>
	</label>
</div>
{#if transactions.length}
	<div class="tablewrap">
		<table>
			<thead><tr><th>Datum</th><th>Type</th><th class="num">Aantal</th></tr></thead>
			<tbody>
				{#each transactions as t (t.id)}
					<tr>
						<td>{new Date(t.date).toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: '2-digit' })}</td>
						<td>
							{typeLabel[t.type] ?? t.type}
							<span class="by">door {displayName(t.expand?.actor ?? {})}</span>
						</td>
						<td class="num">{t.qty}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}

<style>
	.wizards {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 0.6rem;
		margin-bottom: 1.4rem;
	}
	.wizard {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.6rem;
		padding: 1.1rem 1rem;
		font-size: 1.05rem;
		font-weight: 600;
		text-decoration: none;
		border: 1px solid var(--line);
		border-radius: var(--radius);
		background: var(--surface);
		color: inherit;
		box-shadow: var(--shadow);
		transition: transform 0.08s ease;
	}
	.wizard:active {
		transform: scale(0.97);
	}
</style>
