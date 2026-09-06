<script lang="ts">
	import { goto } from '$app/navigation';
	import { pb } from '$lib/pb';

	let email = $state('');
	let code = $state('');
	let otpId = $state('');
	let error = $state('');
	let busy = $state(false);

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

<h1>Inloggen</h1>

{#if !otpId}
	<form onsubmit={requestCode}>
		<label for="email">E-mailadres</label>
		<input id="email" type="email" bind:value={email} required autocomplete="email" />
		<button disabled={busy}>Stuur inlogcode</button>
	</form>
{:else}
	<p>Je ontvangt per e-mail een code om in te loggen.</p>
	<form onsubmit={verify}>
		<label for="code">Code</label>
		<input id="code" inputmode="numeric" bind:value={code} required />
		<button disabled={busy}>Inloggen</button>
	</form>
{/if}

{#if error}<p class="error">{error}</p>{/if}

<style>
	form {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		max-width: 20rem;
	}
	input {
		padding: 0.7rem;
		font-size: 1.1rem;
		border: 1px solid #ccc;
		border-radius: 0.4rem;
	}
	button {
		padding: 0.8rem;
		font-size: 1.05rem;
		border: none;
		border-radius: 0.4rem;
		background: #24211d;
		color: #fff;
		cursor: pointer;
	}
	.error {
		color: #c62828;
	}
</style>
