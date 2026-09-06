<script lang="ts">
	import { pb, displayName, getSettings } from '$lib/pb';
	import BalanceBadge from '$lib/components/BalanceBadge.svelte';
	import type { RecordModel } from 'pocketbase';

	let users = $state<RecordModel[]>([]);
	let letter = $state('');
	let yellow = $state(0);

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
</script>

<h1>Wie ben je?</h1>

{#if !letter}
	<div class="letters">
		{#each letters as l (l)}
			<button class="letter" onclick={() => (letter = l)}>{l}</button>
		{/each}
	</div>
{:else}
	<button class="back" onclick={() => (letter = '')}>← andere letter</button>
	<div class="tiles">
		{#each matches as u (u.id)}
			<a class="tile" href="/tab/{u.id}">
				{displayName(u)}
				<BalanceBadge balance={u.balance ?? 0} yellowThreshold={yellow} />
			</a>
		{:else}
			<p>Geen naam met deze letter.</p>
		{/each}
	</div>
{/if}

<style>
	.letters {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(3.2rem, 1fr));
		gap: 0.5rem;
	}
	.letter {
		padding: 0.9rem 0;
		font-size: 1.2rem;
		font-weight: 700;
		border: none;
		border-radius: 0.6rem;
		background: #fff;
		cursor: pointer;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
	}
	.back {
		background: none;
		border: none;
		cursor: pointer;
		margin-bottom: 0.8rem;
		font-size: 1rem;
	}
</style>
