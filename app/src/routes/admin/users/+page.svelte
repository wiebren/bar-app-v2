<script lang="ts">
	import { pb, displayName, euro } from '$lib/pb';
	import type { RecordModel } from 'pocketbase';

	let users = $state<RecordModel[]>([]);
	let editing = $state<RecordModel | null>(null);
	let adding = $state(false);
	let form = $state({ first_name: '', infix: '', last_name: '', email: '', phone: '', active: true, role: 'user' });
	let msg = $state('');
	let error = $state('');

	async function load() {
		users = await pb.collection('users').getFullList({ sort: 'first_name,last_name' });
	}
	$effect(() => {
		load();
	});

	function startAdd() {
		adding = true;
		editing = null;
		form = { first_name: '', infix: '', last_name: '', email: '', phone: '', active: true, role: 'user' };
	}

	function startEdit(u: RecordModel) {
		editing = u;
		adding = false;
		form = {
			first_name: u.first_name ?? '',
			infix: u.infix ?? '',
			last_name: u.last_name ?? '',
			email: u.email ?? '',
			phone: u.phone ?? '',
			active: !!u.active,
			role: u.role ?? 'user'
		};
	}

	async function save(e: SubmitEvent) {
		e.preventDefault();
		msg = '';
		error = '';
		try {
			if (adding) {
				// password is required by PocketBase but never usable: login is OTP-only
				const pw = crypto.randomUUID() + crypto.randomUUID();
				await pb.collection('users').create({
					...form,
					password: pw,
					passwordConfirm: pw,
					emailVisibility: true
				});
				msg = 'Rekening toegevoegd.';
			} else if (editing) {
				// email changes must go through the server-side hook (PocketBase
				// restricts auth-record email updates to superusers)
				const { email, ...rest } = form;
				await pb.collection('users').update(editing.id, rest);
				if (email !== editing.email) {
					await pb.send('/api/bar/set-email', {
						method: 'POST',
						body: { user: editing.id, email }
					});
				}
				msg = 'Rekening bijgewerkt.';
			}
			adding = false;
			editing = null;
			await load();
		} catch (err) {
			error = (err as Error).message || 'Opslaan mislukt.';
		}
	}

	async function remove(u: RecordModel) {
		if (!confirm(`Rekening van ${displayName(u)} definitief verwijderen?`)) return;
		msg = '';
		error = '';
		try {
			await pb.collection('users').delete(u.id);
			msg = 'Rekening verwijderd.';
			await load();
		} catch {
			error = 'Verwijderen mislukt (alleen inactieve rekeningen kunnen weg).';
		}
	}
</script>

<h1>Rekeningen</h1>

{#if !adding && !editing}
	<button class="btn" onclick={startAdd}>+ Nieuwe rekening</button>
{/if}

{#if adding || editing}
	<form class="panel" onsubmit={save}>
		<h2>{adding ? 'Nieuwe rekening' : `Wijzig: ${displayName(editing!)}`}</h2>
		<div class="row">
			<label>Voornaam<input bind:value={form.first_name} required /></label>
			<label>Tussenvoegsel<input bind:value={form.infix} /></label>
			<label>Achternaam<input bind:value={form.last_name} required /></label>
		</div>
		<div class="row">
			<label>E-mailadres<input type="email" bind:value={form.email} required /></label>
			<label>Telefoon<input bind:value={form.phone} /></label>
		</div>
		<div class="row">
			<label class="check"><input type="checkbox" bind:checked={form.active} />Actief</label>
			<label>Rol
				<select bind:value={form.role}>
					<option value="user">gebruiker</option>
					<option value="admin">beheerder</option>
				</select>
			</label>
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

<div class="tablewrap">
	<table>
		<thead>
			<tr><th>Naam</th><th>E-mail</th><th>Saldo</th><th>Status</th><th></th></tr>
		</thead>
		<tbody>
			{#each users as u (u.id)}
				<tr class:inactive={!u.active}>
					<td>
						{displayName(u)}
						{#if u.role === 'admin'}<span class="chip">beheerder</span>{/if}
					</td>
					<td>{u.email}</td>
					<td>{euro(u.balance ?? 0)}</td>
					<td>{u.active ? 'actief' : 'inactief'}</td>
					<td>
						<button class="link" onclick={() => startEdit(u)}>wijzig</button>
						{#if !u.active}
							<button class="link danger" onclick={() => remove(u)}>verwijder</button>
						{/if}
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<style>
	h1 {
		display: flex;
		justify-content: space-between;
	}
	.inactive {
		opacity: 0.5;
	}
	.link {
		background: none;
		border: none;
		color: var(--ink);
		font-family: inherit;
		text-decoration: underline;
		cursor: pointer;
		padding: 0;
	}
	.link.danger {
		color: var(--bad);
	}
</style>
