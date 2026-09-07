<script lang="ts">
	import { pb, euro } from '$lib/pb';
	import { BRANDS } from '$lib/brands';
	import BrandMark from '$lib/components/BrandMark.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import type { RecordModel } from 'pocketbase';

	let products = $state<RecordModel[]>([]);
	let editing = $state<RecordModel | null>(null);
	let adding = $state(false);
	let form = $state({
		name: '',
		price: 0,
		sort_order: 1000,
		sellable: true,
		stock_tracked: true,
		brand: ''
	});
	let msg = $state('');
	let error = $state('');

	async function load() {
		products = await pb.collection('products').getFullList({ sort: 'sort_order,name' });
	}
	$effect(() => {
		load();
	});

	function startAdd() {
		adding = true;
		editing = null;
		form = { name: '', price: 0, sort_order: 1000, sellable: true, stock_tracked: true, brand: '' };
	}

	function startEdit(p: RecordModel) {
		editing = p;
		adding = false;
		form = {
			name: p.name,
			price: p.price,
			sort_order: p.sort_order ?? 1000,
			sellable: !!p.sellable,
			stock_tracked: !!p.stock_tracked,
			brand: p.brand ?? ''
		};
	}

	async function save(e: SubmitEvent) {
		e.preventDefault();
		msg = '';
		error = '';
		try {
			if (adding) {
				await pb.collection('products').create(form);
				msg = 'Product toegevoegd.';
			} else if (editing) {
				await pb.collection('products').update(editing.id, form);
				msg = 'Product bijgewerkt.';
			}
			adding = false;
			editing = null;
			await load();
		} catch (err) {
			const res = err as { response?: { data?: Record<string, { message?: string }> }; message?: string };
			error =
				Object.values(res.response?.data ?? {})[0]?.message || res.message || 'Opslaan mislukt.';
		}
	}
</script>

<h1>Producten</h1>

{#if !adding && !editing}
	<button class="btn" onclick={startAdd}>+ Nieuw product</button>
{/if}

{#if adding || editing}
	<form class="panel" onsubmit={save}>
		<h2>{adding ? 'Nieuw product' : `Wijzig: ${editing!.name}`}</h2>
		<div class="row">
			<label>Naam<input bind:value={form.name} required maxlength="50" /></label>
			<label>Prijs (€)
				<input type="number" bind:value={form.price} min="0" step="0.01" required />
			</label>
			<label>Volgorde
				<input type="number" bind:value={form.sort_order} min="0" max="9999" step="1" />
			</label>
		</div>
		<div class="row">
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
			<button class="btn">Opslaan</button>
			<button class="btn danger" type="button" onclick={() => { adding = false; editing = null; }}>
				Annuleren
			</button>
		</div>
	</form>
{/if}

{#if msg}<p class="msg">{msg}</p>{/if}
{#if error}<p class="error">{error}</p>{/if}

<!-- the sorted list doubles as the live preview of the till layout -->
<div class="tablewrap">
	<table>
		<thead>
			<tr><th>#</th><th>Product</th><th>Prijs</th><th>Tap</th><th>Voorraad</th><th></th></tr>
		</thead>
		<tbody>
			{#each products as p (p.id)}
				<tr class:inactive={!p.sellable}>
					<td>{p.sort_order}</td>
					<td class="prod">
						{p.name}
						<BrandMark brand={p.brand} height={1.6} />
					</td>
					<td>{euro(p.price)}</td>
					<td>{p.sellable ? '✔' : '—'}</td>
					<td>{p.stock_tracked ? '✔' : '—'}</td>
					<td class="actions">
						<button class="iconbtn small" onclick={() => startEdit(p)} aria-label="Wijzig {p.name}" title="Wijzig">
							<Icon name="pencil" size={18} />
						</button>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<style>
	.inactive {
		opacity: 0.5;
	}
	.actions {
		text-align: right;
	}
	.iconbtn.small {
		width: 2.2rem;
		height: 2.2rem;
	}
	.prod {
		display: flex;
		align-items: center;
		gap: 0.45rem;
	}
</style>
