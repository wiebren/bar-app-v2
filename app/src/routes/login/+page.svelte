<script lang="ts">
	import { pb } from '$lib/pb';
	import { onMount } from 'svelte';

	let email = $state('');
	let code = $state('');
	let otpId = $state('');
	let error = $state('');
	let busy = $state(false);

	// "Zet op je beginscherm" — only shown in a mobile browser, not when the
	// app already runs docked from the home screen.
	type InstallPromptEvent = Event & { prompt: () => Promise<void> };
	let installEvent = $state<InstallPromptEvent | null>(null);
	let iosInstallable = $state(false);
	let iosHintOpen = $state(false);

	onMount(() => {
		const docked =
			window.matchMedia('(display-mode: standalone)').matches ||
			(navigator as { standalone?: boolean }).standalone === true;
		const mobile = window.matchMedia('(pointer: coarse)').matches;
		if (docked || !mobile) return;

		// iPadOS masquerades as macOS but has a touch screen
		const ios =
			/iPhone|iPad|iPod/.test(navigator.userAgent) ||
			(navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
		iosInstallable = ios;

		// Chrome/Edge on Android announce installability with this event;
		// capturing it lets our own button open the native install dialog
		const onPrompt = (e: Event) => {
			e.preventDefault();
			installEvent = e as InstallPromptEvent;
		};
		const onInstalled = () => (installEvent = null);
		window.addEventListener('beforeinstallprompt', onPrompt);
		window.addEventListener('appinstalled', onInstalled);
		return () => {
			window.removeEventListener('beforeinstallprompt', onPrompt);
			window.removeEventListener('appinstalled', onInstalled);
		};
	});

	async function install() {
		if (!installEvent) return;
		await installEvent.prompt();
		installEvent = null;
	}

	async function requestCode(e: SubmitEvent) {
		e.preventDefault();
		busy = true;
		error = '';
		try {
			const res = await pb.collection('users').requestOTP(email.trim());
			otpId = res.otpId;
		} catch {
			error = 'Onbekend e-mailadres.';
		}
		busy = false;
	}

	async function verify(e: SubmitEvent) {
		e.preventDefault();
		busy = true;
		error = '';
		try {
			await pb.collection('users').authWithOTP(otpId, code.trim());
			location.href = '/'; // full reload so the layout re-runs its auth check
		} catch (err) {
			error =
				(err as { status?: number }).status === 403
					? 'Je bent niet meer actief binnen de bar-app. Vraag activatie aan de beheerders.'
					: 'Ongeldige of verlopen code.';
		}
		busy = false;
	}
</script>

<div class="wrap">
	<div class="card">
		<img src="/icon-192.png" alt="" class="logo" />
		<h1>Inloggen</h1>

		{#if !otpId}
			<p class="hint">Vul je e-mailadres in, je ontvangt een e-mail om in te loggen.</p>
			<form onsubmit={requestCode}>
				<label for="email">E-mailadres</label>
				<input id="email" type="email" bind:value={email} required autocomplete="email" />
				<button disabled={busy}>Stuur inlogcode</button>
			</form>
		{:else}
			<p class="hint">
				We hebben een e-mail gestuurd naar <strong>{email}</strong>. Vul hier de code uit de mail
				in.
			</p>
			<form onsubmit={verify}>
				<label for="code">Code</label>
				<input id="code" inputmode="numeric" autocomplete="one-time-code" bind:value={code} required />
				<button disabled={busy}>Inloggen</button>
			</form>
		{/if}

		{#if error}<p class="error">{error}</p>{/if}
	</div>

	{#if installEvent || iosInstallable}
		<div class="install">
			{#if installEvent}
				<button class="install-btn" onclick={install}>
					<span aria-hidden="true">📲</span> Zet de app op je beginscherm
				</button>
			{:else}
				<button class="install-btn" onclick={() => (iosHintOpen = !iosHintOpen)}>
					<span aria-hidden="true">📲</span> Zet de app op je beginscherm
				</button>
				{#if iosHintOpen}
					<p class="install-hint">
						Tik in Safari op de deelknop <span aria-hidden="true">(het vierkantje met de pijl
						omhoog)</span> en kies <strong>‘Zet op beginscherm’</strong>.
					</p>
				{/if}
			{/if}
		</div>
	{/if}
</div>

<style>
	.wrap {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.8rem;
		padding-top: 8vh;
	}
	.install {
		width: 100%;
		max-width: 22rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.install-btn {
		padding: 0.7rem;
		font-size: 0.95rem;
		font-weight: 600;
		border: 1px solid var(--line);
		border-radius: var(--radius-s);
		background: var(--surface);
		color: var(--ink);
		cursor: pointer;
	}
	.install-hint {
		margin: 0;
		font-size: 0.9rem;
		color: var(--muted);
		text-align: center;
	}
	.card {
		width: 100%;
		max-width: 22rem;
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: var(--radius);
		box-shadow: var(--shadow);
		padding: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}
	.logo {
		width: 3rem;
		height: 3rem;
		border-radius: 0.8rem;
	}
	h1 {
		margin: 0.4rem 0 0;
	}
	.hint {
		color: var(--muted);
		margin: 0 0 0.6rem;
		font-size: 0.95rem;
	}
	form {
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
	}
	label {
		font-size: 0.85rem;
		color: var(--muted);
	}
	input {
		padding: 0.75rem;
		font-size: 1.05rem;
		border: 1px solid var(--line);
		border-radius: var(--radius-s);
		font-family: inherit;
	}
	button {
		margin-top: 0.4rem;
		padding: 0.85rem;
		font-size: 1.02rem;
		font-weight: 600;
		border: none;
		border-radius: var(--radius-s);
		background: var(--ink);
		color: var(--surface);
		cursor: pointer;
	}
	button:disabled {
		opacity: 0.5;
	}
	.error {
		color: var(--bad);
		font-size: 0.95rem;
	}
</style>
