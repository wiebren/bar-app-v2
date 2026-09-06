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
			displayName(me as never) || me.email
		);
		const payload = epcPayload({
			accountHolder: s.account_holder,
			iban: s.iban,
			amount: value,
			remittance
		});
		qrDataUrl = await QRCode.toDataURL(payload, { width: 560, margin: 2 });
	}
</script>

<h1>Saldo opwaarderen</h1>

{#if !qrDataUrl}
	<p class="hint">Kies een bedrag en scan de QR-code met je bank-app.</p>
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
	<div class="qrcard">
		<img src={qrDataUrl} alt="EPC QR-code voor {euro(amount)}" />
		<p class="amount">{euro(amount)}</p>
		<p class="note">
			Scan met je bank-app. Je saldo wordt bijgewerkt zodra een beheerder de betaling op het
			bankafschrift heeft verwerkt.
		</p>
	</div>
	<button class="again" onclick={() => (qrDataUrl = '')}>Ander bedrag</button>
{/if}

{#if error}<p class="error">{error}</p>{/if}

<style>
	.hint {
		color: var(--muted);
		margin-top: 0;
	}
	.presets {
		display: flex;
		gap: 0.6rem;
		margin-bottom: 0.8rem;
	}
	.presets button {
		flex: 1;
		padding: 1rem 0;
		font-size: 1.15rem;
		font-weight: 700;
		font-family: inherit;
		border: 1px solid var(--line);
		border-radius: var(--radius);
		background: var(--surface);
		color: inherit;
		cursor: pointer;
		box-shadow: var(--shadow);
	}
	form {
		display: flex;
		gap: 0.6rem;
	}
	input {
		flex: 1;
		padding: 0.75rem;
		font-size: 1.05rem;
		border: 1px solid var(--line);
		border-radius: var(--radius-s);
		font-family: inherit;
	}
	form button,
	.again {
		padding: 0.75rem 1.3rem;
		font-size: 1rem;
		font-weight: 600;
		font-family: inherit;
		border: none;
		border-radius: var(--radius-s);
		background: var(--ink);
		color: var(--surface);
		cursor: pointer;
	}
	.qrcard {
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: var(--radius);
		box-shadow: var(--shadow);
		padding: 1.2rem;
		text-align: center;
		margin-bottom: 0.8rem;
	}
	.qrcard img {
		width: min(100%, 17.5rem);
		image-rendering: pixelated;
	}
	.amount {
		font-size: 1.3rem;
		font-weight: 800;
		margin: 0.4rem 0 0.2rem;
		font-variant-numeric: tabular-nums;
	}
	.note {
		font-size: 0.9rem;
		color: var(--muted);
		margin: 0;
	}
	.error {
		color: var(--bad);
	}
</style>
