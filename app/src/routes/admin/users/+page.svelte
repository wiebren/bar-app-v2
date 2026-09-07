<script lang="ts">
	import { pb, displayName, euro } from '$lib/pb';
	import { downloadCsv } from '$lib/csv';
	import type { RecordModel } from 'pocketbase';

	let users = $state<RecordModel[]>([]);
	let showInactive = $state(false);
	let editing = $state<RecordModel | null>(null);
	let adding = $state(false);
	let form = $state({ first_name: '', infix: '', last_name: '', email: '', phone: '', active: true, role: 'user' });
	let msg = $state('');
	let error = $state('');

	async function load() {
		users = await pb.collection('users').getFullList({
			filter: showInactive ? '' : 'active = true',
			sort: 'first_name,last_name'
		});
	}
	$effect(() => {
		void showInactive; // reload when the toggle changes
		load();
	});

	function startAdd() {
		adding = true;
		editing = null;
		form = { first_name: '', infix: '', last_name: '', email: '', phone: '', active: true, role: 'user' };
		msg = '';
		error = '';
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
		msg = '';
		error = '';
	}

	function rowKey(e: KeyboardEvent, u: RecordModel) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			startEdit(u);
		}
	}

	async function save(e: SubmitEvent) {
		e.preventDefault();
		msg = '';
		error = '';
		try {
			if (adding) {
				// password is required by PocketBase but never usable: login is OTP-only
				// (48 hex chars — PocketBase caps passwords at 71 characters)
				const pw = Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) =>
					b.toString(16).padStart(2, '0')
				).join('');
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
			// surface the first field-level error PocketBase reports, if any
			const res = err as { response?: { data?: Record<string, { message?: string }> }; message?: string };
			error =
				Object.values(res.response?.data ?? {})[0]?.message || res.message || 'Opslaan mislukt.';
		}
	}

	// the old "barrekeningoverzicht" export: every account incl. inactive,
	// with the contact details the mobile table no longer shows
	async function exportCsv() {
		const all = await pb.collection('users').getFullList({ sort: 'first_name,last_name' });
		downloadCsv('barrekeningen.csv', [
			['Naam', 'E-mail', 'Telefoon', 'Saldo', 'Status', 'Rol'],
			...all.map((u) => [
				displayName(u),
				u.email,
				u.phone,
				(u.balance ?? 0).toFixed(2),
				u.active ? 'actief' : 'inactief',
				u.role
			])
		]);
	}

	async function remove(u: RecordModel) {
		if (!confirm(`Rekening van ${displayName(u)} definitief verwijderen?`)) return;
		msg = '';
		error = '';
		try {
			await pb.collection('users').delete(u.id);
			msg = 'Rekening verwijderd.';
			editing = null;
			await load();
		} catch {
			error = 'Verwijderen mislukt (alleen inactieve rekeningen kunnen weg).';
		}
	}
</script>

{#if adding || editing}
	<h1>{adding ? 'Nieuwe rekening' : `Wijzig: ${displayName(editing!)}`}</h1>
	<form class="panel" onsubmit={save}>
		{#if editing}
			<p class="saldo">Saldo: <strong>{euro(editing.balance ?? 0)}</strong></p>
		{/if}
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

	{#if editing}
		<div class="row actions">
			<a class="btnlink" href="/admin/topup?user={editing.id}">Saldo bijschrijven</a>
			<a class="btnlink" href="/admin/payments?user={editing.id}">Betaalgeschiedenis</a>
			<a class="btnlink" href="/admin/sales?user={editing.id}">Bestelgeschiedenis</a>
		</div>
		{#if !editing.active}
			<button class="btn danger delete" onclick={() => remove(editing!)}>
				Rekening definitief verwijderen
			</button>
		{/if}
	{/if}

	{#if error}<p class="error">{error}</p>{/if}
{:else}
	<h1>Rekeningen</h1>
	<div class="bar">
		<button class="btn" onclick={startAdd}>+ Nieuwe rekening</button>
		<button class="btn" onclick={exportCsv}>Exporteer CSV</button>
	</div>

	{#if msg}<p class="msg">{msg}</p>{/if}
	{#if error}<p class="error">{error}</p>{/if}

	<label class="toggle">
		<input type="checkbox" bind:checked={showInactive} />
		toon ook inactieve rekeningen
	</label>

	<div class="tablewrap">
		<table>
			<thead>
				<tr><th>Naam</th><th>Saldo</th></tr>
			</thead>
			<tbody>
				{#each users as u (u.id)}
					<tr
						class="clickable"
						class:inactive={!u.active}
						role="button"
						tabindex="0"
						onclick={() => startEdit(u)}
						onkeydown={(e) => rowKey(e, u)}
					>
						<td class="name">
							{displayName(u)}
							{#if u.role === 'admin'}<span class="chip">beheerder</span>{/if}
							{#if showInactive && !u.active}<span class="chip off">inactief</span>{/if}
						</td>
						<td>{euro(u.balance ?? 0)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}

<style>
	.bar {
		display: flex;
		gap: 0.6rem;
		flex-wrap: wrap;
	}
	.clickable {
		cursor: pointer;
	}
	.clickable:hover td,
	.clickable:focus-visible td {
		background: var(--bg);
	}
	.inactive {
		opacity: 0.55;
	}
	.toggle {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		margin-top: 0.9rem;
		font-size: 0.9rem;
		color: var(--muted);
		cursor: pointer;
	}
	.name {
		max-width: 14rem;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.saldo {
		margin: 0;
		color: var(--muted);
	}
	.saldo strong {
		color: var(--ink);
		font-variant-numeric: tabular-nums;
	}
	.actions {
		display: flex;
		gap: 0.7rem;
		flex-wrap: wrap;
		margin-bottom: 1.1rem;
	}
	.btnlink {
		padding: 0.7rem 1.3rem;
		font-size: 1rem;
		font-weight: 600;
		text-decoration: none;
		border: 1px solid var(--line);
		border-radius: var(--radius-s);
		background: var(--surface);
		color: inherit;
		box-shadow: var(--shadow);
	}
	.delete {
		margin-top: 0.4rem;
	}
	.chip.off {
		background: color-mix(in srgb, var(--muted) 14%, transparent);
		color: var(--muted);
	}
</style>
