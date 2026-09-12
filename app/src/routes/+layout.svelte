<script lang="ts">
	import { page, updated } from '$app/state';
	import { goto } from '$app/navigation';
	import { pb, isAdmin, getSettings } from '$lib/pb';
	import { hasQrTopup, hasTikkieTopup } from '$lib/topup';
	import Icon from '$lib/components/Icon.svelte';
	import { applyTheme, storedTheme, type Theme } from '$lib/theme';
	import { onMount } from 'svelte';

	const THEMES: { key: Theme; label: string; icon: string }[] = [
		{ key: 'auto', label: 'Auto', icon: 'contrast' },
		{ key: 'light', label: 'Licht', icon: 'sun' },
		{ key: 'dark', label: 'Donker', icon: 'moon' }
	];

	let { children } = $props();
	let theme = $state<Theme>('auto');
	let title = $state('Bar-app');
	let ready = $state(false);
	let menuOpen = $state(false);
	// hidden until an admin configures at least one top-up route
	let canTopup = $state(false);

	onMount(async () => {
		if (!pb.authStore.isValid && page.url.pathname !== '/login') {
			await goto('/login');
		} else if (pb.authStore.isValid) {
			try {
				// refresh validates the token and picks up role/active changes
				await pb.collection('users').authRefresh();
			} catch (err) {
				// only a real rejection ends the session; a network hiccup
				// (offline PWA start) must not log out a year-long login
				const status = (err as { status?: number }).status ?? 0;
				if (status === 401 || status === 403 || status === 404) {
					pb.authStore.clear();
					await goto('/login');
					ready = true;
					return;
				}
			}
			try {
				const s = await getSettings();
				title = s.app_title || 'Bar-app';
				canTopup = hasQrTopup(s) || hasTikkieTopup(s);
			} catch {
				// offline — keep the default title, and no QR without settings
			}
		}
		ready = true;
	});

	onMount(() => {
		theme = storedTheme();
		// on 'auto' the CSS follows the system by itself; this only keeps the
		// PWA status-bar colour in step when the system flips while we run
		const mq = window.matchMedia('(prefers-color-scheme: dark)');
		const follow = () => theme === 'auto' && applyTheme('auto', false);
		mq.addEventListener('change', follow);
		return () => mq.removeEventListener('change', follow);
	});

	function pickTheme(t: Theme) {
		theme = t;
		applyTheme(t);
		// menu stays open, so the change is visible and easy to undo
	}

	async function logout() {
		menuOpen = false;
		pb.authStore.clear();
		await goto('/login');
	}

	// iOS keeps a docked PWA resident in memory, so reopening it resumes stale
	// code instead of reloading. On resume, fetch _app/version.json and reload
	// if a new build was deployed.
	async function reloadIfStale() {
		if (document.visibilityState !== 'visible') return;
		try {
			if (await updated.check()) location.reload();
		} catch {
			// offline or version.json unreachable — stay on the running build
		}
	}
</script>

<svelte:document onvisibilitychange={reloadIfStale} />

<svelte:head>
	<title>{title}</title>
</svelte:head>

{#if ready}
	{#if pb.authStore.isValid}
		<header>
			<div class="inner">
				<a href="/" class="brand">
					<img src="/icon-192.png" alt="" class="logo" />
					{title}
				</a>
				<nav>
					{#if canTopup}
						<a href="/topup" class="iconbtn" aria-label="Opwaarderen" title="Opwaarderen">
							<Icon name="qr" />
						</a>
					{/if}
					{#if isAdmin()}
						<a href="/admin" class="iconbtn" aria-label="Beheer" title="Beheer">
							<Icon name="wrench" />
						</a>
					{/if}
					<div class="menuwrap">
						<button
							class="iconbtn"
							onclick={() => (menuOpen = !menuOpen)}
							aria-label="Menu"
							aria-expanded={menuOpen}
						>
							<Icon name="dots" />
						</button>
						{#if menuOpen}
							<button class="scrim" aria-label="Sluit menu" onclick={() => (menuOpen = false)}
							></button>
							<div class="menu">
								<a href="/party" onclick={() => (menuOpen = false)}>
									<Icon name="gift" size={18} /> Ik trakteer
								</a>
								<button onclick={logout}>
									<Icon name="logout" size={18} /> Uitloggen
								</button>
								<div class="themerow" role="group" aria-label="Thema">
									{#each THEMES as t (t.key)}
										<button
											class:on={theme === t.key}
											aria-pressed={theme === t.key}
											onclick={() => pickTheme(t.key)}
										>
											<Icon name={t.icon} size={17} />
											{t.label}
										</button>
									{/each}
								</div>
							</div>
						{/if}
					</div>
				</nav>
			</div>
		</header>
	{/if}
	<main>
		{@render children()}
	</main>
{/if}

<style>
	:global(:root) {
		--bg: #f6f3ee;
		--surface: #ffffff;
		--ink: #211d18;
		--muted: #6f675c;
		--line: #e7e1d8;
		--accent: #a16207;
		--good: #1a7f37;
		--warn: #c2410c;
		--bad: #b91c1c;
		/* text/icons on a solid --good/--bad/--ink fill */
		--on-fill: #ffffff;
		/* light plate third-party logos need to stay readable on a dark surface */
		--plate: transparent;
		--plate-pad: 0;
		--radius: 14px;
		--radius-s: 10px;
		--shadow: 0 1px 2px rgba(33, 29, 24, 0.06), 0 4px 12px rgba(33, 29, 24, 0.05);
		color-scheme: light;
	}
	/* Dark palette, stated twice on purpose: once for "auto" (follow the
	   system unless the member picked light) and once for an explicit choice.
	   data-theme is set by the inline script in app.html and by $lib/theme. */
	@media (prefers-color-scheme: dark) {
		:global(:root:not([data-theme='light'])) {
			--bg: #16130f;
			--surface: #201c17;
			--ink: #f0ebe2;
			--muted: #a79d8e;
			--line: #332e27;
			--accent: #d8a13f;
			--good: #4fbd72;
			--warn: #f08e4f;
			--bad: #ef6f6f;
			--on-fill: #16130f;
			--plate: #ffffff;
			--plate-pad: 0.2rem;
			--shadow: 0 1px 2px rgba(0, 0, 0, 0.5), 0 4px 14px rgba(0, 0, 0, 0.4);
			color-scheme: dark;
		}
	}
	:global(:root[data-theme='dark']) {
		--bg: #16130f;
		--surface: #201c17;
		--ink: #f0ebe2;
		--muted: #a79d8e;
		--line: #332e27;
		--accent: #d8a13f;
		--good: #4fbd72;
		--warn: #f08e4f;
		--bad: #ef6f6f;
		--on-fill: #16130f;
		--plate: #ffffff;
		--plate-pad: 0.2rem;
		--shadow: 0 1px 2px rgba(0, 0, 0, 0.5), 0 4px 14px rgba(0, 0, 0, 0.4);
		color-scheme: dark;
	}
	:global(*),
	:global(*::before),
	:global(*::after) {
		box-sizing: border-box;
	}
	:global(body) {
		margin: 0;
		font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
		background: var(--bg);
		color: var(--ink);
		line-height: 1.5;
		-webkit-font-smoothing: antialiased;
	}
	:global(h1) {
		font-size: 1.35rem;
		letter-spacing: -0.01em;
		margin: 0.25rem 0 1rem;
		text-wrap: balance;
	}
	:global(h2) {
		font-size: 1.05rem;
		letter-spacing: -0.01em;
		margin: 1.2rem 0 0.6rem;
	}
	:global(a) {
		color: inherit;
	}
	:global(:focus-visible) {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
		border-radius: 4px;
	}

	header {
		position: sticky;
		top: 0;
		z-index: 10;
		background: var(--surface);
		border-bottom: 1px solid var(--line);
	}
	.inner {
		max-width: 34rem;
		margin: 0 auto;
		padding: 0.5rem 1rem;
		padding-top: calc(0.5rem + env(safe-area-inset-top));
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	.brand {
		display: inline-flex;
		align-items: center;
		gap: 0.55rem;
		font-weight: 800;
		font-size: 1.05rem;
		letter-spacing: -0.01em;
		text-decoration: none;
	}
	.logo {
		width: 1.9rem;
		height: 1.9rem;
		border-radius: 0.5rem;
	}
	nav {
		display: flex;
		gap: 0.25rem;
		align-items: center;
	}
	:global(.iconbtn) {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2.6rem;
		height: 2.6rem;
		border: none;
		border-radius: 999px;
		background: none;
		color: var(--muted);
		cursor: pointer;
		transition:
			background 0.15s,
			color 0.15s;
	}
	:global(.iconbtn:hover),
	:global(.iconbtn:active) {
		background: var(--bg);
		color: var(--ink);
	}
	.menuwrap {
		position: relative;
	}
	.scrim {
		position: fixed;
		inset: 0;
		z-index: 19;
		background: none;
		border: none;
		cursor: default;
	}
	.menu {
		position: absolute;
		top: calc(100% + 0.35rem);
		right: 0;
		z-index: 20;
		min-width: 12.5rem;
		display: flex;
		flex-direction: column;
		padding: 0.35rem;
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: var(--radius-s);
		box-shadow: var(--shadow);
	}
	.menu a,
	.menu button {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		padding: 0.65rem 0.8rem;
		font-size: 0.98rem;
		font-family: inherit;
		font-weight: 500;
		text-align: left;
		text-decoration: none;
		border: none;
		border-radius: calc(var(--radius-s) - 4px);
		background: none;
		color: inherit;
		cursor: pointer;
	}
	.menu a:hover,
	.menu a:active,
	.menu button:hover,
	.menu button:active {
		background: var(--bg);
	}
	/* light / dark / auto, per device */
	.themerow {
		display: flex;
		gap: 0.2rem;
		margin-top: 0.35rem;
		padding-top: 0.35rem;
		border-top: 1px solid var(--line);
	}
	.menu .themerow button {
		flex: 1;
		flex-direction: column;
		align-items: center;
		gap: 0.2rem;
		padding: 0.45rem 0.2rem;
		font-size: 0.7rem;
		font-weight: 600;
		text-align: center;
		color: var(--muted);
	}
	.menu .themerow button.on {
		background: var(--bg);
		color: var(--ink);
	}

	main {
		max-width: 34rem;
		margin: 0 auto;
		padding: 1.25rem 1rem calc(2rem + env(safe-area-inset-bottom));
	}

	/* shared building blocks */
	:global(.tiles) {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}
	:global(button.tile),
	:global(a.tile) {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.6rem;
		width: 100%;
		padding: 0.95rem 1.1rem;
		border: 1px solid var(--line);
		border-radius: var(--radius);
		background: var(--surface);
		color: inherit;
		font-size: 1.02rem;
		font-weight: 500;
		font-family: inherit;
		text-align: left;
		text-decoration: none;
		cursor: pointer;
		box-shadow: var(--shadow);
		transition: transform 0.08s ease;
	}
	:global(.tile:active) {
		transform: scale(0.985);
	}
	@media (prefers-reduced-motion: reduce) {
		:global(.tile),
		:global(.tile:active) {
			transition: none;
			transform: none;
		}
	}
</style>
