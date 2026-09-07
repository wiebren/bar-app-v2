<script lang="ts">
	import { pb, displayName, isAdmin, getActiveParties } from '$lib/pb';
	import Icon from '$lib/components/Icon.svelte';
	import type { RecordModel } from 'pocketbase';

	let parties = $state<RecordModel[]>([]);
	let loaded = $state(false);
	let message = $state('');
	let capStr = $state('');
	let hours = $state(8);
	let busy = $state(false);
	let error = $state('');

	async function refresh() {
		parties = await getActiveParties();
		loaded = true;
	}

	$effect(() => {
		refresh();
	});

	// one party per host: the form hides while your own is running
	const hostsOwn = $derived(parties.some((p) => p.host === pb.authStore.record?.id));

	function mayStop(party: RecordModel): boolean {
		return party.host === pb.authStore.record?.id || isAdmin();
	}

	async function start(e: SubmitEvent) {
		e.preventDefault();
		busy = true;
		error = '';
		try {
			await pb.send('/api/bar/party', {
				method: 'POST',
				body: { message, cap: parseInt(capStr) || 0, hours }
			});
			message = '';
			capStr = '';
			hours = 8;
			await refresh();
		} catch {
			error = 'Traktatie starten mislukt.';
		}
		busy = false;
	}

	async function stop(party: RecordModel) {
		busy = true;
		error = '';
		try {
			await pb.send('/api/bar/party-stop', { method: 'POST', body: { party: party.id } });
			await refresh();
		} catch {
			error = 'Traktatie stoppen mislukt.';
		}
		busy = false;
	}
</script>

<h1>Ik trakteer</h1>

{#if error}<p class="error">{error}</p>{/if}

{#if !loaded}
	<!-- loading -->
{:else}
	{#each parties as party (party.id)}
		<div class="card">
			<p class="hostline">
				<span class="gift"><Icon name="gift" size={22} /></span>
				<strong>{displayName(party.expand?.host ?? {})} trakteert</strong>
			</p>
			{#if party.message}<p class="message">“{party.message}”</p>{/if}
			<p class="detail">
				Tot {new Date(party.ends).toLocaleString('nl-NL', { dateStyle: 'short', timeStyle: 'short' })}
			</p>
			<p class="detail">
				{#if party.cap > 0}
					{party.used ?? 0} van {party.cap} drankjes gebruikt
				{:else}
					{party.used ?? 0} drankjes gebruikt, geen maximum
				{/if}
			</p>
			{#if mayStop(party)}
				<button class="stopbtn" onclick={() => stop(party)} disabled={busy}>Stop traktatie</button>
			{/if}
		</div>
	{/each}
	{#if !hostsOwn}
		<p class="intro">
			Start een traktatie: iedereen kan drankjes op jouw rekening bestellen zolang die loopt.
		</p>
		<form class="card form" onsubmit={start}>
			<label>
				Bericht (optioneel)
				<input bind:value={message} maxlength="100" placeholder="bijv. Max 2 drankjes p.p." />
			</label>
			<label>
				Maximum aantal drankjes (leeg = geen maximum)
				<input inputmode="numeric" pattern="[0-9]*" bind:value={capStr} placeholder="geen" />
			</label>
			<label>
				Duur (uren)
				<input type="number" bind:value={hours} min="1" max="24" step="1" required />
			</label>
			<button class="startbtn" disabled={busy}>Start traktatie</button>
		</form>
	{/if}
{/if}

<style>
	.card {
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: var(--radius);
		box-shadow: var(--shadow);
		padding: 1.1rem 1.2rem;
		margin-bottom: 1rem;
	}
	.hostline {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 1.15rem;
		margin: 0 0 0.4rem;
	}
	.gift {
		display: inline-flex;
		color: var(--accent);
	}
	.message {
		font-size: 1.05rem;
		margin: 0 0 0.6rem;
	}
	.detail {
		color: var(--muted);
		font-size: 0.92rem;
		margin: 0.15rem 0;
	}
	.intro {
		color: var(--muted);
		margin: -0.4rem 0 1rem;
	}
	.form {
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
	}
	.form label {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		font-size: 0.85rem;
		color: var(--muted);
	}
	.form input {
		padding: 0.6rem;
		font-size: 1rem;
		border: 1px solid var(--line);
		border-radius: var(--radius-s);
		font-family: inherit;
		color: inherit;
		background: var(--surface);
	}
	.startbtn,
	.stopbtn {
		width: 100%;
		padding: 0.95rem;
		font-size: 1.05rem;
		font-weight: 600;
		font-family: inherit;
		border: none;
		border-radius: var(--radius-s);
		cursor: pointer;
	}
	.startbtn {
		background: var(--good);
		color: #fff;
	}
	.stopbtn {
		background: var(--bad);
		color: #fff;
		margin-top: 0.6rem;
	}
	.startbtn:disabled,
	.stopbtn:disabled {
		opacity: 0.5;
	}
	.error {
		color: var(--bad);
	}
</style>
