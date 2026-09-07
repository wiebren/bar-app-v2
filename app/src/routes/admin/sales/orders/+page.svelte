<script lang="ts">
	import { page as route } from '$app/state';
	import { pb, displayName, euro } from '$lib/pb';
	import { downloadCsv } from '$lib/csv';
	import type { RecordModel } from 'pocketbase';

	const PER_PAGE = 100;

	let orders = $state<RecordModel[]>([]);
	let pageNum = $state(1);
	let hasMore = $state(false);
	let filterUser = $state<RecordModel | null>(null);

	async function loadPage(p: number) {
		const uid = route.url.searchParams.get('user');
		const res = await pb.collection('orders').getList(p, PER_PAGE, {
			filter: uid ? `user = "${uid}"` : '',
			sort: '-created',
			expand: 'user,booked_by'
		});
		orders = p === 1 ? res.items : [...orders, ...res.items];
		pageNum = p;
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
</script>

<h1>Bestelhistorie</h1>

{#if filterUser}
	<p class="filternote">
		Alleen bestellingen van <strong>{displayName(filterUser)}</strong> —
		<a href="/admin/sales/orders">toon alles</a>
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
	<button class="btn" onclick={() => loadPage(pageNum + 1)}>Meer laden</button>
{/if}

<style>
	.filternote {
		margin: -0.2rem 0 0.6rem;
		font-size: 0.92rem;
		color: var(--muted);
	}
</style>
