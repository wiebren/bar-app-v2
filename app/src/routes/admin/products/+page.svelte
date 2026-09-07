<script lang="ts">
	import { pb, euro } from '$lib/pb';
	import { BRANDS } from '$lib/brands';
	import BrandMark from '$lib/components/BrandMark.svelte';
	import type { RecordModel } from 'pocketbase';

	let products = $state<RecordModel[]>([]);
	let editing = $state<RecordModel | null>(null);
	let adding = $state(false);
	let form = $state({ name: '', price: 0, sellable: true, stock_tracked: true, brand: '' });
	// 'first' or the id of the product this one comes after
	let placement = $state('first');
	let busy = $state(false);
	let msg = $state('');
	let error = $state('');
	// current stock per product id, summed from the ledger
	let stock = $state<Record<string, number>>({});

	async function load() {
		products = await pb.collection('products').getFullList({ sort: 'sort_order,name' });
		const entries = await pb.collection('stock_entries').getFullList({ fields: 'product,qty' });
		const sums: Record<string, number> = {};
		for (const s of entries) {
			sums[s.product] = (sums[s.product] ?? 0) + (s.qty ?? 0);
		}
		stock = sums;
	}
	$effect(() => {
		load();
	});

	// retired products (nothing to sell, no stock to track) get their own section
	const activeProducts = $derived(products.filter((p) => p.sellable || p.stock_tracked));
	const inactiveProducts = $derived(products.filter((p) => !p.sellable && !p.stock_tracked));
	const others = $derived(products.filter((p) => p.id !== editing?.id));

	function startAdd() {
		adding = true;
		editing = null;
		form = { name: '', price: 0, sellable: true, stock_tracked: true, brand: '' };
		placement = products.length ? products[products.length - 1].id : 'first';
		msg = '';
		error = '';
	}

	function startEdit(p: RecordModel) {
		editing = p;
		adding = false;
		form = {
			name: p.name,
			price: p.price,
			sellable: !!p.sellable,
			stock_tracked: !!p.stock_tracked,
			brand: p.brand ?? ''
		};
		const idx = products.findIndex((x) => x.id === p.id);
		placement = idx <= 0 ? 'first' : products[idx - 1].id;
		msg = '';
		error = '';
	}

	function rowKey(e: KeyboardEvent, p: RecordModel) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			startEdit(p);
		}
	}

	async function save(e: SubmitEvent) {
		e.preventDefault();
		busy = true;
		msg = '';
		error = '';
		try {
			let id: string;
			if (adding) {
				const rec = await pb.collection('products').create({ ...form, sort_order: 0 });
				id = rec.id;
			} else {
				await pb.collection('products').update(editing!.id, form);
				id = editing!.id;
			}

			// place the product and renumber everything ×10, so the order stays
			// clean no matter how often products are moved around
			const rest = products.filter((p) => p.id !== id);
			const at = placement === 'first' ? 0 : rest.findIndex((p) => p.id === placement) + 1;
			const ordered = [...rest.slice(0, at), { id }, ...rest.slice(at)];
			for (let i = 0; i < ordered.length; i++) {
				const target = (i + 1) * 10;
				const current = products.find((p) => p.id === ordered[i].id);
				if (!current || current.sort_order !== target) {
					await pb.collection('products').update(ordered[i].id, { sort_order: target });
				}
			}

			msg = adding ? 'Product toegevoegd.' : 'Product bijgewerkt.';
			adding = false;
			editing = null;
			await load();
		} catch (err) {
			const res = err as { response?: { data?: Record<string, { message?: string }> }; message?: string };
			error =
				Object.values(res.response?.data ?? {})[0]?.message || res.message || 'Opslaan mislukt.';
		}
		busy = false;
	}
</script>

{#if adding || editing}
	<h1>{adding ? 'Nieuw product' : `Wijzig: ${editing!.name}`}</h1>
	<form class="panel" onsubmit={save}>
		<div class="row">
			<label>Naam<input bind:value={form.name} required maxlength="50" /></label>
			<label>Prijs (€)
				<input type="number" bind:value={form.price} min="0" step="0.01" required />
			</label>
		</div>
		<div class="row">
			<label>Plaats in de lijst
				<select bind:value={placement}>
					<option value="first">Eerste</option>
					{#each others as p (p.id)}
						<option value={p.id}>Na {p.name}</option>
					{/each}
				</select>
			</label>
			<label>Merk
				<select bind:value={form.brand}>
					<option value="">geen merk</option>
					{#each Object.entries(BRANDS) as [key, b] (key)}
						<option value={key}>{b.label}</option>
					{/each}
				</select>
			</label>
		</div>
		<div class="row">
			<label class="check"><input type="checkbox" bind:checked={form.sellable} />Verkrijgbaar op de tap</label>
			<label class="check"><input type="checkbox" bind:checked={form.stock_tracked} />Voorraad bijhouden</label>
		</div>
		<div class="row">
			<button class="btn" disabled={busy}>Opslaan</button>
			<button class="btn danger" type="button" onclick={() => { adding = false; editing = null; }}>
				Annuleren
			</button>
		</div>
	</form>

	{#if editing?.stock_tracked}
		<h2>Voorraad ({stock[editing.id] ?? 0})</h2>
		<div class="row stockbtns">
			<a class="btnlink" href="/admin/stock/add?product={editing.id}">Inkoop boeken</a>
			<a class="btnlink" href="/admin/stock/count?product={editing.id}">Voorraad tellen</a>
			<a class="btnlink" href="/admin/sales/transactions?product={editing.id}">Transacties</a>
		</div>
	{/if}

	{#if error}<p class="error">{error}</p>{/if}
{:else}
	<h1>Producten</h1>
	<button class="btn" onclick={startAdd}>+ Nieuw product</button>

	{#if msg}<p class="msg">{msg}</p>{/if}
	{#if error}<p class="error">{error}</p>{/if}

	<!-- the sorted list doubles as the live preview of the till layout -->
	<div class="tablewrap">
		<table>
			<thead>
				<tr><th>Product</th><th>Prijs</th><th>Voorraad</th></tr>
			</thead>
			<tbody>
				{#each activeProducts as p (p.id)}
					<tr
						class="clickable"
						class:offtap={!p.sellable}
						role="button"
						tabindex="0"
						onclick={() => startEdit(p)}
						onkeydown={(e) => rowKey(e, p)}
					>
						<td class="prod">
							{p.name}
							<BrandMark brand={p.brand} height={1.6} />
							{#if !p.sellable}<span class="chip off">niet op de tap</span>{/if}
						</td>
						<td>{euro(p.price)}</td>
						<td>{p.stock_tracked ? (stock[p.id] ?? 0) : '—'}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	{#if inactiveProducts.length}
		<h2>Inactief</h2>
		<div class="tablewrap">
			<table>
				<tbody>
					{#each inactiveProducts as p (p.id)}
						<tr
							class="clickable offtap"
							role="button"
							tabindex="0"
							onclick={() => startEdit(p)}
							onkeydown={(e) => rowKey(e, p)}
						>
							<td class="prod">
								{p.name}
								<BrandMark brand={p.brand} height={1.6} />
							</td>
							<td>{euro(p.price)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
{/if}

<style>
	.clickable {
		cursor: pointer;
	}
	.clickable:hover td,
	.clickable:focus-visible td {
		background: var(--bg);
	}
	.offtap {
		opacity: 0.5;
	}
	.prod {
		display: flex;
		align-items: center;
		gap: 0.45rem;
	}
	.chip.off {
		background: color-mix(in srgb, var(--muted) 14%, transparent);
		color: var(--muted);
	}
	.stockbtns {
		display: flex;
		gap: 0.7rem;
		flex-wrap: wrap;
	}
</style>
