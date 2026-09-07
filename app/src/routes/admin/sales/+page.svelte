<script lang="ts">
	import { page as route } from '$app/state';
	import { pb, displayName, euro } from '$lib/pb';
	import { downloadCsv } from '$lib/csv';
	import type { RecordModel } from 'pocketbase';

	const PER_PAGE = 100;

	let orders = $state<RecordModel[]>([]);
	let page = $state(1);
	let hasMore = $state(false);
	let filterUser = $state<RecordModel | null>(null);

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

	async function loadPage(p: number) {
		const uid = route.url.searchParams.get('user');
		const res = await pb.collection('orders').getList(p, PER_PAGE, {
			filter: uid ? `user = "${uid}"` : '',
			sort: '-created',
			expand: 'user,booked_by'
		});
		orders = p === 1 ? res.items : [...orders, ...res.items];
		page = p;
		hasMore = p < res.totalPages;
	}
	$effect(() => {
		// ?user=… (from the account edit screen) shows one account's orders
		const uid = route.url.searchParams.get('user');
		(async () => {
			filterUser = uid ? await pb.collection('users').getOne(uid) : null;
			await loadPage(1);
		})();
	});

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

	async function exportHistory() {
		// the on-screen list is paged; the export must contain everything
		const uid = route.url.searchParams.get('user');
		const all = await pb.collection('orders').getFullList({
			filter: uid ? `user = "${uid}"` : '',
			sort: '-created',
			expand: 'user,booked_by'
		});
		downloadCsv('verkoophistorie.csv', [
			['Datum', 'Tijd', 'Product', 'Stukprijs', 'Aantal', 'Totaal', 'Rekening', 'Gestreept door'],
			...all.map((o) => {
				const d = new Date(o.created);
				return [
					d.toLocaleDateString('nl-NL'),
					d.toLocaleTimeString('nl-NL'),
					o.product_name,
					(o.unit_price ?? 0).toFixed(2),
					o.qty,
					(o.total ?? 0).toFixed(2),
					displayName(o.expand?.user ?? {}),
					displayName(o.expand?.booked_by ?? {})
				];
			})
		]);
	}

	function exportReport() {
		downloadCsv(`verkoop-per-product-${from}-${to}.csv`, [
			['Product', 'Aantal', 'Omzet'],
			...report.map(([name, agg]) => [name, agg.qty, agg.total.toFixed(2)])
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
{#if filterUser}
	<p class="filternote">
		Alleen bestellingen van <strong>{displayName(filterUser)}</strong> —
		<a href="/admin/sales">toon alles</a>
	</p>
{/if}
<button class="btn" onclick={exportHistory} disabled={!orders.length}>Exporteer CSV</button>
<div class="tablewrap">
	<table>
		<thead>
			<tr><th>Datum</th><th>Bestelling</th><th class="num">Totaal</th></tr>
		</thead>
		<tbody>
			{#each orders as o (o.id)}
				<tr>
					<td>{new Date(o.created).toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: '2-digit' })}</td>
					<td class="what">
						{o.qty}× {o.product_name}
						<span class="by">
							{displayName(o.expand?.user ?? {})}{#if o.booked_by !== o.user}
								· door {displayName(o.expand?.booked_by ?? {})}{/if}
						</span>
					</td>
					<td class="num">{euro(o.total ?? 0)}</td>
				</tr>
			{:else}
				<tr><td colspan="3">Nog geen verkopen.</td></tr>
			{/each}
		</tbody>
	</table>
</div>
{#if hasMore}
	<button class="btn" onclick={() => loadPage(page + 1)}>Meer laden</button>
{/if}

<style>
	.filternote {
		margin: -0.2rem 0 0.6rem;
		font-size: 0.92rem;
		color: var(--muted);
	}
</style>
