<script lang="ts">
	import { page } from '$app/state';
	import { pb, displayName, euro, getSettings } from '$lib/pb';
	import BalanceBadge from '$lib/components/BalanceBadge.svelte';
	import type { RecordModel } from 'pocketbase';

	let tabUser = $state<RecordModel | null>(null);
	let products = $state<RecordModel[]>([]);
	let lastOrders = $state<RecordModel[]>([]);
	let lastPayment = $state<RecordModel | null>(null);
	let yellow = $state(0);

	// re-runs when the route param changes (switching tabs via /browse)
	$effect(() => {
		const id = page.params.user!;
		(async () => {
			yellow = (await getSettings()).yellow_threshold ?? 0;
			tabUser = await pb.collection('users').getOne(id);
			products = await pb.collection('products').getFullList({
				filter: 'sellable = true',
				sort: 'sort_order,name'
			});
			// history of the SELECTED tab — the old app wrongly showed the logged-in user's
			const orders = await pb.collection('orders').getList(1, 5, {
				filter: `user = "${id}"`,
				sort: '-created',
				expand: 'booked_by'
			});
			lastOrders = orders.items;
			const payments = await pb.collection('payments').getList(1, 1, {
				filter: `user = "${id}"`,
				sort: '-created'
			});
			lastPayment = payments.items[0] ?? null;
		})();
	});
</script>

{#if tabUser}
	<h1>
		{displayName(tabUser)}
		<BalanceBadge balance={tabUser.balance ?? 0} yellowThreshold={yellow} />
	</h1>

	<div class="tiles">
		{#each products as p (p.id)}
			<a class="tile" href="/tab/{tabUser.id}/order/{p.id}">
				{p.name}
				<strong>{euro(p.price)}</strong>
			</a>
		{/each}
	</div>

	<footer>
		{#if lastPayment}
			<p>Laatste opwaardering: {euro(lastPayment.amount)} op
				{new Date(lastPayment.created).toLocaleDateString('nl-NL')}</p>
		{/if}
		{#if lastOrders.length}
			<h2>Laatste bestellingen</h2>
			<ul>
				{#each lastOrders as o (o.id)}
					<li>
						{new Date(o.created).toLocaleString('nl-NL', { dateStyle: 'short', timeStyle: 'short' })}:
						{o.qty}× {o.product_name}
						{#if o.booked_by !== o.user && o.expand?.booked_by}
							<em>door {displayName(o.expand.booked_by)}</em>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</footer>
{/if}

<style>
	h1 {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.5rem;
		font-size: 1.3rem;
	}
	footer {
		margin-top: 1.5rem;
		font-size: 0.9rem;
		color: #5c564e;
	}
	footer h2 {
		font-size: 1rem;
		margin-bottom: 0.3rem;
	}
	footer ul {
		margin: 0;
		padding-left: 1.1rem;
	}
</style>
