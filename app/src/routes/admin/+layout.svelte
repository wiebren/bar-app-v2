<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { isAdmin } from '$lib/pb';
	import Icon from '$lib/components/Icon.svelte';
	import { onMount } from 'svelte';

	let { children } = $props();
	let ok = $state(false);

	onMount(() => {
		if (!isAdmin()) goto('/');
		else ok = true;
	});
</script>

{#if ok}
	{#if page.url.pathname !== '/admin'}
		<nav class="crumbs">
			<a href="/admin"><Icon name="back" size={16} /> Beheer</a>
		</nav>
	{/if}
	{@render children()}
{/if}

<style>
	.crumbs {
		margin-bottom: 0.9rem;
		font-size: 0.92rem;
	}
	.crumbs a {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		color: var(--muted);
		text-decoration: none;
	}
	.crumbs a:hover {
		color: var(--ink);
	}

	/* shared admin styling, used by every /admin page */
	:global(form.panel),
	:global(div.panel) {
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: var(--radius);
		padding: 1.1rem;
		margin-bottom: 1.1rem;
		box-shadow: var(--shadow);
	}
	:global(.panel h2) {
		margin: 0.2rem 0;
	}
	:global(.panel label) {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		font-size: 0.85rem;
		color: var(--muted);
	}
	:global(.panel input),
	:global(.panel select),
	:global(.panel textarea) {
		padding: 0.6rem;
		font-size: 1rem;
		border: 1px solid var(--line);
		border-radius: var(--radius-s);
		font-family: inherit;
		color: inherit;
		background: var(--surface);
	}
	:global(.panel .row) {
		display: flex;
		gap: 0.7rem;
		flex-wrap: wrap;
	}
	:global(.panel .row > label) {
		flex: 1;
		min-width: 8rem;
	}
	:global(.panel label.check) {
		flex-direction: row;
		align-items: center;
		gap: 0.5rem;
		font-size: 1rem;
		color: inherit;
	}
	:global(button.btn) {
		padding: 0.7rem 1.3rem;
		font-size: 1rem;
		font-weight: 600;
		font-family: inherit;
		border: none;
		border-radius: var(--radius-s);
		background: var(--ink);
		color: var(--surface);
		cursor: pointer;
		align-self: flex-start;
	}
	:global(button.btn.danger) {
		background: var(--bad);
	}
	:global(a.btnlink) {
		display: inline-block;
		padding: 0.7rem 1.3rem;
		font-size: 1rem;
		font-weight: 600;
		text-decoration: none;
		border: 1px solid var(--line);
		border-radius: var(--radius-s);
		background: var(--surface);
		color: inherit;
		box-shadow: var(--shadow);
	}
	/* big tappable action buttons, shared with the admin front page */
	:global(a.action) {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.6rem;
		padding: 1.1rem 1rem;
		font-size: 1.05rem;
		font-weight: 600;
		text-decoration: none;
		border: 1px solid var(--line);
		border-radius: var(--radius);
		background: var(--surface);
		color: inherit;
		box-shadow: var(--shadow);
		transition: transform 0.08s ease;
	}
	:global(a.action:active) {
		transform: scale(0.97);
	}
	:global(button.btn:disabled) {
		opacity: 0.5;
	}
	:global(.tablewrap) {
		overflow-x: auto;
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: var(--radius);
		box-shadow: var(--shadow);
		margin: 0.9rem 0 1.1rem;
	}
	:global(.tablewrap table) {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.9rem;
		font-variant-numeric: tabular-nums;
	}
	:global(.tablewrap th),
	:global(.tablewrap td) {
		padding: 0.55rem 0.75rem;
		text-align: left;
		border-bottom: 1px solid var(--line);
		white-space: nowrap;
	}
	:global(.tablewrap tr:last-child td) {
		border-bottom: none;
	}
	:global(.tablewrap th) {
		color: var(--muted);
		font-weight: 600;
		font-size: 0.8rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	:global(.tablewrap .num) {
		text-align: right;
		font-weight: 600;
	}
	:global(.tablewrap th.num) {
		font-weight: 600;
	}
	:global(.tablewrap .num.light) {
		font-weight: 400;
		color: var(--muted);
	}
	:global(.tablewrap .by) {
		display: block;
		font-size: 0.78rem;
		font-weight: 400;
		color: var(--muted);
	}
	:global(p.msg) {
		color: var(--good);
		font-weight: 600;
	}
	:global(p.error) {
		color: var(--bad);
	}
	:global(.chip) {
		display: inline-block;
		padding: 0.05rem 0.5rem;
		border-radius: 999px;
		font-size: 0.75rem;
		font-weight: 600;
		background: color-mix(in srgb, var(--accent) 14%, transparent);
		color: var(--accent);
		vertical-align: middle;
	}
</style>
