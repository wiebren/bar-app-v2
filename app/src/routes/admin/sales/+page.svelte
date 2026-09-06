<script lang="ts">
	import { pb, displayName, euro } from '$lib/pb';
	import { downloadCsv } from '$lib/csv';
	import type { RecordModel } from 'pocketbase';

	const PER_PAGE = 100;

	let orders = $state<RecordModel[]>([]);
	let page = $state(1);
	let hasMore = $state(false);

	// per-product report
	let from = $state(new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10));
	let to = $state(new Date().toISOString().slice(0, 10));
	let report = $state<[string, { qty: number; total: number }][]>([]);

	async function loadPage(p: number) {
		const res = await pb.collection('orders').getList(p, PER_PAGE, {
			sort: '-created',
			expand: 'user,booked_by'
		});
		orders = p === 1 ? res.items : [...orders, ...res.items];
		page = p;
		hasMore = p < res.totalPages;
	}
	$effect(() => {
		loadPage(1);
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

	function exportHistory() {
		downloadCsv('verkoophistorie.csv', [
			['Datum', 'Tijd', 'Product', 'Stukprijs', 'Aantal', 'Totaal', 'Rekening', 'Gestreept door'],
			...orders.map((o) => {
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
			<thead><tr><th>Product</th><th>Aantal</th><th>Omzet</th></tr></thead>
			<tbody>
				{#each report as [name, agg] (name)}
					<tr><td>{name}</td><td>{agg.qty}</td><td>{euro(agg.total)}</td></tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}

<h2>Historie</h2>
<button class="btn" onclick={exportHistory} disabled={!orders.length}>Exporteer CSV (geladen regels)</button>
<div class="tablewrap">
	<table>
		<thead>
			<tr>
				<th>Datum</th><th>Product</th><th>Aantal</th><th>Totaal</th>
				<th>Rekening</th><th>Gestreept door</th>
			</tr>
		</thead>
		<tbody>
			{#each orders as o (o.id)}
				<tr>
					<td>{new Date(o.created).toLocaleString('nl-NL', { dateStyle: 'short', timeStyle: 'short' })}</td>
					<td>{o.product_name}</td>
					<td>{o.qty}</td>
					<td>{euro(o.total ?? 0)}</td>
					<td>{displayName(o.expand?.user ?? {})}</td>
					<td>{displayName(o.expand?.booked_by ?? {})}</td>
				</tr>
			{:else}
				<tr><td colspan="6">Nog geen verkopen.</td></tr>
			{/each}
		</tbody>
	</table>
</div>
{#if hasMore}
	<button class="btn" onclick={() => loadPage(page + 1)}>Meer laden</button>
{/if}
