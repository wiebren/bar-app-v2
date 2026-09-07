<script lang="ts">
	import { pb, euro } from '$lib/pb';
	import { downloadCsv } from '$lib/csv';
	import Icon from '$lib/components/Icon.svelte';
	import type { RecordModel } from 'pocketbase';

	// per-product report
	let from = $state(new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10));
	let to = $state(new Date().toISOString().slice(0, 10));
	let report = $state<[string, { qty: number; total: number }][]>([]);

	// turnover per fiscal year (September–August), like the old financial overview
	let turnover = $state<[string, number][]>([]);

	// stock report
	let stockFrom = $state(new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10));
	let stockTo = $state(new Date().toISOString().slice(0, 10));
	let stockReport = $state<
		{ name: string; begin: number; purchases: number; sales: number; counts: number; end: number }[]
	>([]);

	$effect(() => {
		(async () => {
			const all = await pb.collection('orders').getFullList({ fields: 'created,total' });
			const byYear = new Map<string, number>();
			for (const o of all) {
				const d = new Date(o.created);
				const startYear = d.getMonth() + 1 < 9 ? d.getFullYear() - 1 : d.getFullYear();
				const key = `${startYear} - ${startYear + 1}`;
				byYear.set(key, (byYear.get(key) ?? 0) + (o.total ?? 0));
			}
			turnover = [...byYear.entries()].sort((a, b) => b[0].localeCompare(a[0]));
		})();
	});

	async function runReport(e?: SubmitEvent) {
		e?.preventDefault();
		const rows = await pb.collection('orders').getFullList({
			filter: `created >= "${from} 00:00:00" && created <= "${to} 23:59:59"`,
			fields: 'product_name,qty,total'
		});
		const byProduct = new Map<string, { qty: number; total: number }>();
		for (const r of rows) {
			const agg = byProduct.get(r.product_name) ?? { qty: 0, total: 0 };
			agg.qty += r.qty ?? 0;
			agg.total += r.total ?? 0;
			byProduct.set(r.product_name, agg);
		}
		report = [...byProduct.entries()].sort((a, b) => b[1].total - a[1].total);
	}

	function exportReport() {
		downloadCsv(`verkoop-per-product-${from}-${to}.csv`, [
			['Product', 'Aantal', 'Omzet'],
			...report.map(([name, agg]) => [name, agg.qty, agg.total.toFixed(2)])
		]);
	}

	async function runStockReport(e?: SubmitEvent) {
		e?.preventDefault();
		const products = await pb.collection('products').getFullList({
			filter: 'stock_tracked = true',
			sort: 'sort_order,name'
		});
		const entries = await pb.collection('stock_entries').getFullList({
			fields: 'product,type,qty,date'
		});
		const fromTs = `${stockFrom} 00:00:00`;
		const toTs = `${stockTo} 23:59:59`;
		stockReport = products.map((p) => {
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

	function exportStockReport() {
		downloadCsv(`voorraad-${stockFrom}-${stockTo}.csv`, [
			['Product', 'Beginstand', 'Inkoop', 'Verkoop', 'Correcties', 'Eindstand'],
			...stockReport.map((r) => [r.name, r.begin, r.purchases, r.sales, r.counts, r.end])
		]);
	}
</script>

<h1>Verkoop & rapporten</h1>

{#if turnover.length}
	<h2>Omzet per boekjaar</h2>
	<div class="tablewrap">
		<table>
			<thead><tr><th>Boekjaar (sep–aug)</th><th class="num">Omzet</th></tr></thead>
			<tbody>
				{#each turnover as [year, total] (year)}
					<tr><td>{year}</td><td class="num">{euro(total)}</td></tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}

<h2>Per product</h2>
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
			<thead><tr><th>Product</th><th class="num">Aantal</th><th class="num">Omzet</th></tr></thead>
			<tbody>
				{#each report as [name, agg] (name)}
					<tr><td>{name}</td><td class="num">{agg.qty}</td><td class="num">{euro(agg.total)}</td></tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}

<h2>Voorraadrapport</h2>
<form class="panel" onsubmit={runStockReport}>
	<div class="row">
		<label>Van<input type="date" bind:value={stockFrom} required /></label>
		<label>Tot en met<input type="date" bind:value={stockTo} required /></label>
	</div>
	<div class="row">
		<button class="btn">Toon</button>
		<button class="btn" type="button" onclick={exportStockReport} disabled={!stockReport.length}>
			CSV
		</button>
	</div>
</form>
{#if stockReport.length}
	<div class="tablewrap">
		<table>
			<thead>
				<tr>
					<th>Product</th><th class="num">Begin</th><th class="num">In</th>
					<th class="num">Uit</th><th class="num">Corr.</th><th class="num">Eind</th>
				</tr>
			</thead>
			<tbody>
				{#each stockReport as r (r.name)}
					<tr>
						<td>{r.name}</td><td class="num light">{r.begin}</td><td class="num light">{r.purchases}</td>
						<td class="num light">{r.sales}</td><td class="num light">{r.counts}</td><td class="num">{r.end}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}

<h2>Historie</h2>
<div class="links">
	<a class="action" href="/admin/sales/orders">
		<Icon name="history" size={24} /> Bestelhistorie
	</a>
	<a class="action" href="/admin/payments">
		<Icon name="receipt" size={24} /> Betalingshistorie
	</a>
	<a class="action" href="/admin/sales/transactions">
		<Icon name="crate" size={24} /> Voorraadtransacties
	</a>
</div>

<style>
	.links {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 0.6rem;
	}
	.links > a:last-child {
		grid-column: 1 / -1;
	}
</style>
