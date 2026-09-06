<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { pb, isAdmin, getSettings } from '$lib/pb';
	import { onMount } from 'svelte';

	let { children } = $props();
	let title = $state('Bar-app');
	let ready = $state(false);

	onMount(async () => {
		if (!pb.authStore.isValid && page.url.pathname !== '/login') {
			await goto('/login');
		} else if (pb.authStore.isValid) {
			try {
				// refresh validates the token and picks up role/active changes
				await pb.collection('users').authRefresh();
				title = (await getSettings()).app_title || 'Bar-app';
			} catch {
				pb.authStore.clear();
				await goto('/login');
			}
		}
		ready = true;
	});

	async function logout() {
		pb.authStore.clear();
		await goto('/login');
	}
</script>

<svelte:head>
	<title>{title}</title>
</svelte:head>

{#if ready}
	{#if pb.authStore.isValid}
		<header>
			<a href="/" class="brand">{title}</a>
			<nav>
				<a href="/browse">👥</a>
				<a href="/topup">💶</a>
				{#if isAdmin()}<a href="/admin">🔧</a>{/if}
				<button onclick={logout} title="Uitloggen">⏻</button>
			</nav>
		</header>
	{/if}
	<main>
		{@render children()}
	</main>
{/if}

<style>
	:global(body) {
		margin: 0;
		font-family: system-ui, sans-serif;
		background: #f5f2ee;
		color: #24211d;
	}
	header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.6rem 1rem;
		background: #24211d;
		color: #f5f2ee;
	}
	.brand {
		color: inherit;
		text-decoration: none;
		font-weight: 700;
	}
	nav {
		display: flex;
		gap: 0.75rem;
		align-items: center;
	}
	nav a,
	nav button {
		font-size: 1.2rem;
		text-decoration: none;
		background: none;
		border: none;
		color: inherit;
		cursor: pointer;
		padding: 0;
	}
	main {
		max-width: 32rem;
		margin: 0 auto;
		padding: 1rem;
	}
	:global(button.tile),
	:global(a.tile) {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
		padding: 0.9rem 1rem;
		border: none;
		border-radius: 0.6rem;
		background: #fff;
		color: inherit;
		font-size: 1.05rem;
		text-decoration: none;
		cursor: pointer;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
	}
	:global(.tiles) {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
</style>
