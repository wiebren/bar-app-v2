<script lang="ts">
	import { page } from '$app/state';
	import { pb } from '$lib/pb';
	import { onMount } from 'svelte';

	let email = $state('');
	let code = $state('');
	let otpId = $state('');
	let error = $state('');
	let busy = $state(false);
	let autoLogin = $state(false);

	// the login button in the OTP mail links to /login?otpId=...&code=...
	onMount(async () => {
		const linkOtpId = page.url.searchParams.get('otpId');
		const linkCode = page.url.searchParams.get('code');
		if (!linkOtpId || !linkCode) return;
		autoLogin = true;
		try {
			await pb.collection('users').authWithOTP(linkOtpId, linkCode);
			if (!pb.authStore.record?.active) {
				pb.authStore.clear();
				error = 'Je bent niet meer actief binnen de bar-app. Vraag activatie aan de beheerders.';
			} else {
				location.href = '/';
				return;
			}
		} catch {
			error = 'Ongeldige of verlopen inloglink. Vraag hieronder een nieuwe code aan.';
		}
		autoLogin = false;
	});

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
			if (!pb.authStore.record?.active) {
				pb.authStore.clear();
				error = 'Je bent niet meer actief binnen de bar-app. Vraag activatie aan de beheerders.';
			} else {
				location.href = '/'; // full reload so the layout re-runs its auth check
			}
		} catch {
			error = 'Ongeldige of verlopen code.';
		}
		busy = false;
	}
</script>

<div class="wrap">
	<div class="card">
		<img src="/favicon.png" alt="" class="logo" />
		<h1>Inloggen</h1>

		{#if autoLogin}
			<p class="hint">Bezig met inloggen…</p>
		{:else if !otpId}
			<p class="hint">Vul je e-mailadres in, je ontvangt een e-mail om in te loggen.</p>
			<form onsubmit={requestCode}>
				<label for="email">E-mailadres</label>
				<input id="email" type="email" bind:value={email} required autocomplete="email" />
				<button disabled={busy}>Stuur inlogcode</button>
			</form>
		{:else}
			<p class="hint">
				We hebben een e-mail gestuurd naar <strong>{email}</strong>. Klik op de knop in de mail, of
				vul hier de code in.
			</p>
			<form onsubmit={verify}>
				<label for="code">Code</label>
				<input id="code" inputmode="numeric" autocomplete="one-time-code" bind:value={code} required />
				<button disabled={busy}>Inloggen</button>
			</form>
		{/if}

		{#if error}<p class="error">{error}</p>{/if}
	</div>
</div>

<style>
	.wrap {
		display: flex;
		justify-content: center;
		padding-top: 8vh;
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
