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
</style>
