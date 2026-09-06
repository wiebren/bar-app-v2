<script lang="ts">
	import { goto } from '$app/navigation';
	import { isAdmin } from '$lib/pb';
	import { onMount } from 'svelte';

	let { children } = $props();
	let ok = $state(false);

	onMount(() => {
		if (!isAdmin()) goto('/');
		else ok = true;
	});
</script>

{#if ok}
	<nav class="crumbs"><a href="/admin">Beheer</a></nav>
	{@render children()}
{/if}

<style>
	.crumbs {
		margin-bottom: 0.8rem;
		font-size: 0.9rem;
	}

	/* shared admin styling, used by every /admin page */
	:global(form.panel),
	:global(div.panel) {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		background: #fff;
		border-radius: 0.6rem;
		padding: 1rem;
		margin-bottom: 1rem;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
	}
	:global(.panel label) {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		font-size: 0.85rem;
		color: #5c564e;
	}
	:global(.panel input),
	:global(.panel select),
	:global(.panel textarea) {
		padding: 0.55rem;
		font-size: 1rem;
		border: 1px solid #ccc;
		border-radius: 0.4rem;
		font-family: inherit;
	}
	:global(.panel .row) {
		display: flex;
		gap: 0.6rem;
		flex-wrap: wrap;
	}
	:global(.panel .row > label) {
		flex: 1;
		min-width: 8rem;
	}
	:global(.panel label.check) {
		flex-direction: row;
		align-items: center;
		font-size: 1rem;
	}
	:global(button.btn) {
		padding: 0.7rem 1.2rem;
		font-size: 1rem;
		border: none;
		border-radius: 0.4rem;
		background: #24211d;
		color: #fff;
		cursor: pointer;
		align-self: flex-start;
	}
	:global(button.btn.danger) {
		background: #c62828;
	}
	:global(button.btn:disabled) {
		opacity: 0.5;
	}
	:global(.tablewrap) {
		overflow-x: auto;
		background: #fff;
		border-radius: 0.6rem;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
		margin-bottom: 1rem;
	}
	:global(.tablewrap table) {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.9rem;
		font-variant-numeric: tabular-nums;
	}
	:global(.tablewrap th),
	:global(.tablewrap td) {
		padding: 0.5rem 0.7rem;
		text-align: left;
		border-bottom: 1px solid #eee;
		white-space: nowrap;
	}
	:global(.tablewrap th) {
		color: #5c564e;
		font-weight: 600;
	}
	:global(p.msg) {
		color: #2e7d32;
		font-weight: 600;
	}
	:global(p.error) {
		color: #c62828;
	}
</style>
