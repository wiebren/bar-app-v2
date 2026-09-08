<script lang="ts">
	import { pb, getSettings, invalidateSettings } from '$lib/pb';

	let id = $state('');
	let form = $state<Record<string, unknown>>({});
	let msg = $state('');
	let error = $state('');

	$effect(() => {
		(async () => {
			const s = await getSettings();
			id = s.id;
			form = { ...s };
		})();
	});

	async function save(e: SubmitEvent) {
		e.preventDefault();
		msg = '';
		error = '';
		try {
			await pb.collection('settings').update(id, form);
			invalidateSettings();
			msg = 'Instellingen opgeslagen.';
		} catch {
			error = 'Opslaan mislukt.';
		}
	}
</script>

<h1>Instellingen</h1>

{#if msg}<p class="msg">{msg}</p>{/if}
{#if error}<p class="error">{error}</p>{/if}

{#if id}
	<form class="panel" onsubmit={save}>
		<h2>Algemeen</h2>
		<div class="row">
			<label>Naam van de app<input bind:value={form.app_title} /></label>
			<label>Afzendadres mails<input type="email" bind:value={form.sender_address} /></label>
		</div>
		<div class="row">
			<label>Geel vanaf saldo onder (€)
				<input type="number" step="0.01" bind:value={form.yellow_threshold} />
			</label>
			<label>Waarschuwingsmail bij saldo onder (€)
				<input type="number" step="0.01" bind:value={form.red_alert_threshold} />
			</label>
		</div>

		<h2>Opwaarderen — QR-code</h2>
		<p class="sub">Leeg laten verbergt de QR-code op het opwaardeerscherm.</p>
		<div class="row">
			<label>IBAN<input bind:value={form.iban} placeholder="NL00BANK0123456789" /></label>
			<label>Naam rekeninghouder<input bind:value={form.account_holder} /></label>
		</div>
		<label>Omschrijving (gebruik {'{naam}'})
			<input bind:value={form.remittance_template} />
		</label>

		<h2>Opwaarderen — Tikkie via WhatsApp</h2>
		<p class="sub">Leeg laten verbergt de knop &ldquo;Vraag Tikkie&rdquo;.</p>
		<label>WhatsApp-nummer penningmeester
			<input type="tel" bind:value={form.tikkie_phone} placeholder="+31 6 12345678" />
		</label>
		<label>Bericht (gebruik {'{naam}'} en {'{bedrag}'})
			<input bind:value={form.tikkie_template} />
		</label>

		<h2>Mail bij rood saldo</h2>
		<label>Onderwerp<input bind:value={form.mail_red_subject} /></label>
		<div class="row">
			<label>Aanhef<input bind:value={form.mail_red_salutation} /></label>
		</div>
		<label>Tekst vóór het saldo<textarea rows="2" bind:value={form.mail_red_text_before}></textarea></label>
		<label>Tekst na het saldo<textarea rows="2" bind:value={form.mail_red_text_after}></textarea></label>

		<h2>Mail bij geel saldo</h2>
		<label>Onderwerp<input bind:value={form.mail_yellow_subject} /></label>
		<div class="row">
			<label>Aanhef<input bind:value={form.mail_yellow_salutation} /></label>
		</div>
		<label>Tekst vóór het saldo<textarea rows="2" bind:value={form.mail_yellow_text_before}></textarea></label>
		<label>Tekst na het saldo<textarea rows="2" bind:value={form.mail_yellow_text_after}></textarea></label>

		<h2>Dagoverzicht</h2>
		<label class="check">
			<input type="checkbox" bind:checked={form.digest_enabled as boolean} />
			Dagelijkse bevestigingsmail met consumpties versturen
		</label>

		<button class="btn">Opslaan</button>
	</form>
{/if}
