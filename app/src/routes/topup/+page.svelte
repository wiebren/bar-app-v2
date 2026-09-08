<script lang="ts">
	import { pb, displayName, euro, getSettings } from '$lib/pb';
	import { epcPayload } from '$lib/epc';
	import { hasQrTopup, hasTikkieTopup, tikkieMessage, waLink, type TopupSettings } from '$lib/topup';
	import QRCode from 'qrcode';

	const PRESETS = [10, 20, 50];
	// WhatsApp glyph — filled, so it can't ride along in the stroked Icon set
	const WHATSAPP =
		'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z';

	let settings = $state<TopupSettings | null>(null);
	let amount = $state(0);
	let custom = $state('');
	let qrDataUrl = $state('');
	let error = $state('');

	const me = pb.authStore.record!;
	const memberName = displayName(me as never) || me.email;

	const qr = $derived(hasQrTopup(settings));
	const tikkie = $derived(hasTikkieTopup(settings));
	const tikkieHref = $derived(
		tikkie
			? waLink(
					settings!.tikkie_phone!,
					tikkieMessage(settings!.tikkie_template ?? '', memberName, euro(amount))
				)
			: ''
	);

	$effect(() => {
		(async () => {
			try {
				settings = (await getSettings()) as TopupSettings;
			} catch {
				error = 'De instellingen konden niet worden geladen.';
			}
		})();
	});

	async function choose(value: number) {
		error = '';
		amount = value;
		if (!qr) return;
		const remittance = (settings!.remittance_template ?? 'Bartegoed {naam}').replace(
			'{naam}',
			memberName
		);
		const payload = epcPayload({
			accountHolder: settings!.account_holder!,
			iban: settings!.iban!,
			amount: value,
			remittance
		});
		qrDataUrl = await QRCode.toDataURL(payload, { width: 560, margin: 2 });
	}

	function reset() {
		amount = 0;
		qrDataUrl = '';
		custom = '';
	}
</script>

<h1>Saldo opwaarderen</h1>

{#if settings && !qr && !tikkie}
	<p class="error">De beheerder heeft nog geen manier van opwaarderen ingesteld.</p>
{:else if !amount}
	<p class="hint">
		{#if qr && tikkie}
			Kies een bedrag; daarna vraag je een Tikkie aan of scan je de QR-code.
		{:else if tikkie}
			Kies een bedrag en vraag een Tikkie aan.
		{:else}
			Kies een bedrag en scan de QR-code met je bank-app.
		{/if}
	</p>
	<div class="presets">
		{#each PRESETS as p (p)}
			<button onclick={() => choose(p)}>{euro(p)}</button>
		{/each}
	</div>
	<form
		onsubmit={(e) => {
			e.preventDefault();
			const v = parseFloat(custom.replace(',', '.'));
			if (v > 0) choose(v);
		}}
	>
		<input inputmode="decimal" placeholder="ander bedrag" bind:value={custom} />
		<button>OK</button>
	</form>
{:else}
	<p class="amount">{euro(amount)}</p>

	{#if tikkie}
		<a class="whatsapp" href={tikkieHref} target="_blank" rel="noopener">
			<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
				<path d={WHATSAPP} />
			</svg>
			Vraag Tikkie
		</a>
		<p class="note">
			Je stuurt een WhatsApp-bericht met dit bedrag; je krijgt een Tikkie terug om te betalen.
		</p>
	{/if}

	{#if qr}
		<p class="or">
			{tikkie ? 'of scan de QR-code met je bank-app' : 'Scan de QR-code met je bank-app'}
		</p>
		<div class="qrcard">
			{#if qrDataUrl}
				<img class="qr" src={qrDataUrl} alt="EPC QR-code voor {euro(amount)}" />
			{/if}
			<div class="banks">
				<img src="/banks/ing.png" alt="ING" />
				<img class="square" src="/banks/bunq.svg" alt="bunq" />
				<img src="/banks/knab.svg" alt="Knab" />
			</div>
		</div>
	{/if}

	<p class="note">
		Je saldo wordt bijgewerkt zodra een beheerder de betaling op het bankafschrift heeft verwerkt.
	</p>
	<button class="again" onclick={reset}>Ander bedrag</button>
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
	.again {
		display: block;
		margin: 0 auto;
	}
	.amount {
		font-size: 1.9rem;
		font-weight: 800;
		margin: 0 0 0.8rem;
		text-align: center;
		font-variant-numeric: tabular-nums;
	}
	.whatsapp {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.6rem;
		padding: 0.95rem 1.2rem;
		border-radius: var(--radius);
		background: #25d366;
		color: #fff;
		font-size: 1.1rem;
		font-weight: 700;
		text-decoration: none;
		box-shadow: var(--shadow);
	}
	.or {
		text-align: center;
		color: var(--muted);
		font-size: 0.95rem;
		margin: 1.2rem 0 0.6rem;
	}
	.qrcard {
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: var(--radius);
		box-shadow: var(--shadow);
		padding: 1.2rem;
		text-align: center;
	}
	.qr {
		width: min(100%, 17.5rem);
		image-rendering: pixelated;
	}
	.banks {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 1rem;
		margin-top: 0.9rem;
		opacity: 0.75;
	}
	.banks img {
		height: 1.15rem;
		width: auto;
		max-width: 4.5rem;
		object-fit: contain;
	}
	/* app-icon marks read smaller than a wordmark at the same height */
	.banks img.square {
		height: 1.5rem;
		border-radius: 5px;
	}
	.note {
		font-size: 0.9rem;
		color: var(--muted);
		text-align: center;
		margin: 0.6rem 0 0.8rem;
	}
	.error {
		color: var(--bad);
	}
</style>
