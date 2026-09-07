<script lang="ts">
	import { pb, displayName, euro, getSettings } from '$lib/pb';
	import BalanceBadge from '$lib/components/BalanceBadge.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import type { RecordModel } from 'pocketbase';

	const PRESETS = [5, 10, 20, 50];

	let users = $state<RecordModel[]>([]);
	let letter = $state('');
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

	const letters = $derived([...new Set(users.map((u) => (u.first_name?.[0] ?? '?').toUpperCase()))]);
	const matches = $derived(users.filter((u) => (u.first_name?.[0] ?? '?').toUpperCase() === letter));
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
			letter = '';
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
	{#if !letter}
		<div class="letters">
			{#each letters as l (l)}
				<button class="letter" onclick={() => (letter = l)}>{l}</button>
			{/each}
		</div>
	{:else}
		<button class="backlink" onclick={() => (letter = '')}>
			<Icon name="back" size={18} /> andere letter
		</button>
		<div class="tiles">
			{#each matches as u (u.id)}
				<button class="tile" onclick={() => { selected = u; result = ''; }}>
					{displayName(u)}
					<BalanceBadge balance={u.balance ?? 0} yellowThreshold={yellow} />
				</button>
			{:else}
				<p>Geen naam met deze letter.</p>
			{/each}
		</div>
	{/if}
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
	.letters {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(3.4rem, 1fr));
		gap: 0.6rem;
	}
	.letter {
		aspect-ratio: 1;
		font-size: 1.25rem;
		font-weight: 700;
		font-family: inherit;
		border: 1px solid var(--line);
		border-radius: var(--radius-s);
		background: var(--surface);
		color: inherit;
		cursor: pointer;
		box-shadow: var(--shadow);
	}
	.letter:active {
		transform: scale(0.95);
	}
	.backlink {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		background: none;
		border: none;
		color: var(--muted);
		font-family: inherit;
		font-size: 0.95rem;
		cursor: pointer;
		padding: 0;
		margin-bottom: 0.9rem;
	}
</style>
