<script lang="ts">
	import { pb, displayName, getSettings } from '$lib/pb';
	import BalanceBadge from '$lib/components/BalanceBadge.svelte';
	import Icon from '$lib/components/Icon.svelte';
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
	<button class="back" onclick={() => (letter = '')}>
		<Icon name="back" size={18} /> andere letter
	</button>
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
	.back {
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
