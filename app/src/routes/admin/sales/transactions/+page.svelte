<script lang="ts">
	import { page as route } from '$app/state';
	import { pb, displayName } from '$lib/pb';
	import type { RecordModel } from 'pocketbase';

	const typeLabel: Record<string, string> = { purchase: 'inkoop', sale: 'verkoop', count: 'telling' };

	let products = $state<RecordModel[]>([]);
	let productId = $state('');
	let transactions = $state<RecordModel[]>([]);
	let txTotal = $state(0);

	$effect(() => {
		// ?product=… (from the product edit screen) preselects the product
		const preselect = route.url.searchParams.get('product');
		(async () => {
			products = await pb.collection('products').getFullList({
				filter: 'stock_tracked = true',
				sort: 'sort_order,name'
			});
			if (preselect && !productId && products.some((p) => p.id === preselect)) {
				productId = preselect;
				await load();
			}
		})();
	});

	async function load() {
		if (!productId) return;
		const res = await pb.collection('stock_entries').getList(1, 100, {
			filter: `product = "${productId}"`,
			sort: '-date',
			expand: 'actor'
		});
		transactions = res.items;
		txTotal = res.totalItems;
	}
</script>

<h1>Voorraadtransacties</h1>

<div class="panel">
	<label>Product
		<select bind:value={productId} onchange={load}>
			<option value="" disabled>kies…</option>
			{#each products as p (p.id)}
				<option value={p.id}>{p.name}</option>
			{/each}
		</select>
	</label>
</div>

{#if transactions.length}
	{#if txTotal > transactions.length}
		<p class="capnote">Laatste {transactions.length} van {txTotal} transacties.</p>
	{/if}
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
{:else if productId}
	<p class="capnote">Nog geen transacties voor dit product.</p>
{/if}

<style>
	.capnote {
		font-size: 0.92rem;
		color: var(--muted);
		margin: 0.2rem 0 0.4rem;
	}
</style>
