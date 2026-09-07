<script lang="ts">
	import { page } from '$app/state';
	import { pb, displayName, euro, getSettings } from '$lib/pb';
	import { BRANDS } from '$lib/brands';
	import BalanceBadge from '$lib/components/BalanceBadge.svelte';
	import BrandMark from '$lib/components/BrandMark.svelte';
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
	<div class="head">
		<h1>{displayName(tabUser)}</h1>
		<BalanceBadge balance={tabUser.balance ?? 0} yellowThreshold={yellow} />
	</div>

	{#if tabUser.id !== pb.authStore.record?.id}
		<p class="foreign">
			Je streept eenmalig voor deze rekening — na de bestelling kom je terug op
			<a href="/tab/{pb.authStore.record?.id}">je eigen rekening</a>.
		</p>
	{/if}

	<div class="products">
		{#each products as p (p.id)}
			{@const brand = BRANDS[p.brand]}
			<a
				class="product"
				href="/tab/{tabUser.id}/order/{p.id}"
				style:border-left={brand ? `5px solid ${brand.color}` : undefined}
			>
				<span class="text">
					<span class="name">{p.name}</span>
					<span class="price">{euro(p.price)}</span>
				</span>
				<BrandMark brand={p.brand} />
			</a>
		{/each}
	</div>

	{#if lastPayment || lastOrders.length}
		<section class="history">
			{#if lastPayment}
				<p class="payment">
					Laatste opwaardering: <strong>{euro(lastPayment.amount)}</strong> op
					{new Date(lastPayment.created).toLocaleDateString('nl-NL')}
				</p>
			{/if}
			{#if lastOrders.length}
				<h2>Laatste bestellingen</h2>
				<ul>
					{#each lastOrders as o (o.id)}
						<li>
							<span class="when">
								{new Date(o.created).toLocaleString('nl-NL', { dateStyle: 'short', timeStyle: 'short' })}
							</span>
							<span>
								{o.qty}× {o.product_name}
								{#if o.booked_by !== o.user && o.expand?.booked_by}
									<em>door {displayName(o.expand.booked_by)}</em>
								{/if}
							</span>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	{/if}
{/if}

<style>
	.head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.6rem;
		margin-bottom: 1rem;
	}
	.head h1 {
		margin: 0;
	}
	.foreign {
		margin: -0.4rem 0 1rem;
		font-size: 0.9rem;
		color: var(--muted);
	}
	.products {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 0.6rem;
	}
	.product {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.5rem;
		padding: 0.9rem 1rem;
		border: 1px solid var(--line);
		border-radius: var(--radius);
		background: var(--surface);
		box-shadow: var(--shadow);
		text-decoration: none;
		transition: transform 0.08s ease;
	}
	.text {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		min-width: 0;
	}
	.product:active {
		transform: scale(0.97);
	}
	.name {
		font-weight: 600;
		font-size: 1.02rem;
	}
	.price {
		color: var(--accent);
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}
	.history {
		margin-top: 1.6rem;
		padding-top: 1rem;
		border-top: 1px solid var(--line);
		font-size: 0.9rem;
		color: var(--muted);
	}
	.payment {
		margin: 0;
	}
	.history h2 {
		font-size: 0.85rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--muted);
		margin: 0.9rem 0 0.4rem;
	}
	.history ul {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}
	.history li {
		display: flex;
		gap: 0.6rem;
	}
	.when {
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
	@media (prefers-reduced-motion: reduce) {
		.product,
		.product:active {
			transition: none;
			transform: none;
		}
	}
</style>
