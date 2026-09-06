<script lang="ts">
	import { pb, displayName, euro, getSettings } from '$lib/pb';
	import BalanceBadge from '$lib/components/BalanceBadge.svelte';
	import type { RecordModel } from 'pocketbase';

	const PRESETS = [5, 10, 20, 50];

	let users = $state<RecordModel[]>([]);
	let search = $state('');
	let selected = $state<RecordModel | null>(null);
	let amountStr = $state('');
	let negative = $state(false);
	let confirming = $state(false);
	let yellow = $state(0);
	let result = $state('');
	let error = $state('');

	$effect(() => {
		(async () => {
			yellow = (await getSettings()).yellow_threshold ?? 0;
			users = await pb.collection('users').getFullList({
				filter: 'active = true',
				sort: 'first_name,last_name'
			});
		})();
	});

	const filtered = $derived(
		users.filter((u) => displayName(u).toLowerCase().includes(search.toLowerCase()))
	);
	const amount = $derived((negative ? -1 : 1) * (parseFloat(amountStr.replace(',', '.')) || 0));

	async function commit() {
		error = '';
		try {
			const res = await pb.send('/api/bar/topup', {
				method: 'POST',
				body: { user: selected!.id, amount }
			});
			result = `${euro(amount)} ${amount >= 0 ? 'bijgeschreven' : 'gecorrigeerd'} op de rekening van ${displayName(selected!)}. Nieuw saldo: ${euro(res.newBalance)}.`;
			selected = null;
			amountStr = '';
			negative = false;
			confirming = false;
			users = await pb.collection('users').getFullList({ filter: 'active = true', sort: 'first_name,last_name' });
		} catch {
			error = 'Bijschrijven mislukt.';
			confirming = false;
		}
	}
</script>

<h1>Saldo bijschrijven</h1>

{#if result}<p class="msg">{result}</p>{/if}
{#if error}<p class="error">{error}</p>{/if}

{#if !selected}
	<div class="panel">
		<label>Zoek rekening<input bind:value={search} placeholder="naam…" /></label>
	</div>
	<div class="tiles">
		{#each filtered as u (u.id)}
			<button class="tile" onclick={() => { selected = u; result = ''; }}>
				{displayName(u)}
				<BalanceBadge balance={u.balance ?? 0} yellowThreshold={yellow} />
			</button>
		{/each}
	</div>
{:else if !confirming}
	<form
		class="panel"
		onsubmit={(e) => {
			e.preventDefault();
			if (amount !== 0) confirming = true;
		}}
	>
		<h2>{displayName(selected)} — huidig saldo {euro(selected.balance ?? 0)}</h2>
		<div class="row">
			{#each PRESETS as p (p)}
				<button type="button" class="btn preset" onclick={() => (amountStr = String(p))}>{euro(p)}</button>
			{/each}
		</div>
		<div class="row">
			<label>Bedrag (€)<input inputmode="decimal" bind:value={amountStr} required /></label>
			<label class="check">
				<input type="checkbox" bind:checked={negative} />afboeken (correctie)
			</label>
		</div>
		<div class="row">
			<button class="btn">Verder</button>
			<button class="btn danger" type="button" onclick={() => (selected = null)}>Annuleren</button>
		</div>
	</form>
{:else}
	<div class="panel">
		<h2>Bevestigen</h2>
		<p>
			{euro(amount)} {amount >= 0 ? 'bijschrijven op' : 'afboeken van'} de rekening van
			<strong>{displayName(selected)}</strong>.<br />
			Saldo: {euro(selected.balance ?? 0)} → <strong>{euro((selected.balance ?? 0) + amount)}</strong>
		</p>
		<div class="row">
			<button class="btn" onclick={commit}>OK</button>
			<button class="btn danger" onclick={() => (confirming = false)}>Terug</button>
		</div>
	</div>
{/if}

<style>
	.preset {
		flex: 1;
	}
</style>
