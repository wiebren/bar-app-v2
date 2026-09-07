<script lang="ts">
	import { BRANDS } from '$lib/brands';

	let { brand, height = 1.9 }: { brand: string | undefined; height?: number } = $props();

	const b = $derived(BRANDS[brand ?? '']);
</script>

{#if b}
	{#if b.logo}
		<span class="badge" style:height="{height}rem" title={b.label}>
			<img src={b.logo} alt={b.label} />
		</span>
	{:else}
		<span
			class="chip"
			style:width="{height}rem"
			style:height="{height}rem"
			style:background={b.color}
			style:color={b.fg}
			title={b.label}>{b.initials}</span
		>
	{/if}
{/if}

<style>
	.badge {
		flex-shrink: 0;
		display: inline-flex;
		align-items: center;
		background: #fff;
		border: 1px solid var(--line);
		border-radius: 0.5rem;
		padding: 0.16rem 0.34rem;
	}
	.badge img {
		display: block;
		height: 100%;
		width: auto;
		max-width: 3.6rem;
		object-fit: contain;
	}
	.chip {
		flex-shrink: 0;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: 999px;
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.02em;
	}
</style>
