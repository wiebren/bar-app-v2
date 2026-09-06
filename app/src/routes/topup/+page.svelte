<script lang="ts">
	import { pb, displayName, euro, getSettings } from '$lib/pb';
	import { epcPayload } from '$lib/epc';
	import QRCode from 'qrcode';

	const PRESETS = [10, 20, 50];

	let amount = $state(0);
	let custom = $state('');
	let qrDataUrl = $state('');
	let error = $state('');

	async function makeQr(value: number) {
		error = '';
		const s = await getSettings();
		if (!s.iban || !s.account_holder) {
			error = 'De beheerder heeft nog geen IBAN ingesteld.';
			return;
		}
		amount = value;
		const me = pb.authStore.record!;
		const remittance = (s.remittance_template || 'Bartegoed {naam}').replace(
			'{naam}',
			displayName(me) || me.email
		);
		const payload = epcPayload({
			accountHolder: s.account_holder,
			iban: s.iban,
			amount: value,
			remittance
		});
		qrDataUrl = await QRCode.toDataURL(payload, { width: 280, margin: 2 });
	}
</script>

<h1>Saldo opwaarderen</h1>

{#if !qrDataUrl}
	<p>Kies een bedrag en scan de QR-code met je bank-app.</p>
	<div class="presets">
		{#each PRESETS as p (p)}
			<button onclick={() => makeQr(p)}>{euro(p)}</button>
		{/each}
	</div>
	<form
		onsubmit={(e) => {
			e.preventDefault();
			const v = parseFloat(custom.replace(',', '.'));
			if (v > 0) makeQr(v);
		}}
	>
		<input inputmode="decimal" placeholder="ander bedrag" bind:value={custom} />
		<button>OK</button>
	</form>
{:else}
	<p>Scan met je bank-app om <strong>{euro(amount)}</strong> over te maken:</p>
	<img src={qrDataUrl} alt="EPC QR-code voor {euro(amount)}" />
	<p class="note">
		Je saldo wordt bijgewerkt zodra een beheerder de betaling op het bankafschrift heeft verwerkt.
	</p>
	<button class="again" onclick={() => (qrDataUrl = '')}>Ander bedrag</button>
{/if}

{#if error}<p class="error">{error}</p>{/if}

<style>
	.presets {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 0.8rem;
	}
	.presets button {
		flex: 1;
		padding: 1rem 0;
		font-size: 1.2rem;
		border: none;
		border-radius: 0.6rem;
		background: #fff;
		cursor: pointer;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
	}
	form {
		display: flex;
		gap: 0.5rem;
	}
	input {
		flex: 1;
		padding: 0.7rem;
		font-size: 1.1rem;
		border: 1px solid #ccc;
		border-radius: 0.4rem;
	}
	form button,
	.again {
		padding: 0.7rem 1.2rem;
		border: none;
		border-radius: 0.4rem;
		background: #24211d;
		color: #fff;
		cursor: pointer;
	}
	img {
		display: block;
		margin: 0.5rem 0;
		max-width: 100%;
	}
	.note {
		font-size: 0.9rem;
		color: #5c564e;
	}
	.error {
		color: #c62828;
	}
</style>
