<script lang="ts">
	import { pb, displayName, euro } from '$lib/pb';
	import { downloadCsv } from '$lib/csv';
	import Icon from '$lib/components/Icon.svelte';
	import type { RecordModel } from 'pocketbase';

	const views = [
		['actief', 'Actief'],
		['rood', 'Staat rood'],
		['inactief', 'Inactief']
	] as const;
	// "rood" matches the debtor mails in pb_hooks: active accounts below zero
	const viewFilters: Record<string, string> = {
		actief: 'active = true',
		rood: 'active = true && balance < 0',
		inactief: 'active = false'
	};

	let users = $state<RecordModel[]>([]);
	let view = $state<string>('actief');
	let editing = $state<RecordModel | null>(null);
	let adding = $state(false);
	let form = $state({
		first_name: '',
		infix: '',
		last_name: '',
		email: '',
		active: true,
		role: 'user',
		block_others: false
	});
	let msg = $state('');
	let error = $state('');

	async function load() {
		users = await pb.collection('users').getFullList({
			filter: viewFilters[view],
			sort: 'first_name,last_name'
		});
	}
	$effect(() => {
		void view; // reload when the filter changes
		load();
	});

	function startAdd() {
		adding = true;
		editing = null;
		form = {
			first_name: '',
			infix: '',
			last_name: '',
			email: '',
			active: true,
			role: 'user',
			block_others: false
		};
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
			active: !!u.active,
			role: u.role ?? 'user',
			block_others: !!u.block_others
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
		<label>E-mailadres<input type="email" bind:value={form.email} required /></label>
		<label class="check">
			<input
				type="checkbox"
				checked={!form.block_others}
				onchange={(e) => (form.block_others = !e.currentTarget.checked)}
			/>
			Anderen mogen op deze rekening strepen
		</label>
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
		<div class="actions">
			<a class="action" href="/admin/topup?user={editing.id}">
				<Icon name="euro" size={24} /> Saldo bijschrijven
			</a>
			<a class="action" href="/admin/payments?user={editing.id}">
				<Icon name="receipt" size={24} /> Betaalgeschiedenis
			</a>
			<a class="action" href="/admin/sales/orders?user={editing.id}">
				<Icon name="history" size={24} /> Bestelgeschiedenis
			</a>
			{#if editing.active}
				<a class="action" href="/party?host={editing.id}">
					<Icon name="gift" size={24} /> Traktatie starten
				</a>
			{/if}
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

	<div class="seg" role="group" aria-label="Welke rekeningen">
		{#each views as [value, label] (value)}
			<button type="button" class:active={view === value} onclick={() => (view = value)}>
				{label}
			</button>
		{/each}
	</div>

	{#if users.length}
		<div class="tablewrap">
			<table>
				<thead>
					<tr><th>Naam</th><th>Saldo</th></tr>
				</thead>
				<tbody>
					{#each users as u (u.id)}
						<tr
							class="clickable"
							role="button"
							tabindex="0"
							onclick={() => startEdit(u)}
							onkeydown={(e) => rowKey(e, u)}
						>
							<td class="name">
								{displayName(u)}
								{#if u.role === 'admin'}<span class="chip">beheerder</span>{/if}
							</td>
							<td>{euro(u.balance ?? 0)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{:else}
		<p class="none">Geen rekeningen in deze weergave.</p>
	{/if}
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
	/* same pill filter as the voorraadtransacties screen */
	.seg {
		display: flex;
		gap: 0.4rem;
		flex-wrap: wrap;
		margin-top: 0.9rem;
	}
	.seg button {
		padding: 0.45rem 0.9rem;
		font-size: 0.9rem;
		font-weight: 600;
		font-family: inherit;
		border: 1px solid var(--line);
		border-radius: 999px;
		background: var(--surface);
		color: var(--muted);
		cursor: pointer;
	}
	.seg button.active {
		background: var(--ink);
		border-color: var(--ink);
		color: var(--surface);
	}
	.none {
		font-size: 0.92rem;
		color: var(--muted);
		margin: 0.9rem 0;
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
	/* one per row: "Betaalgeschiedenis" alone outgrows half a phone screen,
	   and a two-column grid would widen past the page instead of wrapping */
	.actions {
		display: grid;
		gap: 0.6rem;
		margin-bottom: 1.1rem;
	}
	.delete {
		margin-top: 0.4rem;
	}
</style>
