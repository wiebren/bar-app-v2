<script lang="ts">
	import { pb, euro } from '$lib/pb';

	type Recipient = { id: string; name: string; balance: number; email: string };

	let groups = $state<{ key: 'red' | 'yellow'; title: string; list: Recipient[] }[]>([
		{ key: 'red', title: 'Rood (saldo onder 0)', list: [] },
		{ key: 'yellow', title: 'Geel (saldo raakt op)', list: [] }
	]);
	let msg = $state('');
	let error = $state('');

	$effect(() => {
		(async () => {
			for (const g of groups) {
				g.list = await pb.send(`/api/bar/mail-debtors/${g.key}`, { method: 'GET' });
			}
		})();
	});

	async function send(key: 'red' | 'yellow', count: number) {
		if (!confirm(`${count} mails versturen?`)) return;
		msg = '';
		error = '';
		try {
			const res = await pb.send(`/api/bar/mail-debtors/${key}`, { method: 'POST' });
			msg = `${res.mailed} mails verstuurd.`;
		} catch {
			error = 'Versturen mislukt — controleer de SMTP-instellingen in PocketBase.';
		}
	}
</script>

<h1>Saldo-mails</h1>
<p>Dit is precies wie er gemaild wordt (actief, met e-mailadres). Teksten staan bij Instellingen.</p>

{#if msg}<p class="msg">{msg}</p>{/if}
{#if error}<p class="error">{error}</p>{/if}

{#each groups as g (g.key)}
	<h2>{g.title}</h2>
	<div class="panel">
		{#if g.list.length}
			<ul>
				{#each g.list as r (r.id)}
					<li>{r.name} ({r.email}) — {euro(r.balance)}</li>
				{/each}
			</ul>
			<button class="btn" onclick={() => send(g.key, g.list.length)}>
				Verstuur {g.list.length} mails
			</button>
		{:else}
			<p>Niemand in deze groep. 🎉</p>
		{/if}
	</div>
{/each}

<style>
	ul {
		margin: 0;
		padding-left: 1.2rem;
	}
</style>
