<script lang="ts">
	import { BRANDS } from '$lib/brands';

	let { brand, height = 2.4 }: { brand: string | undefined; height?: number } = $props();

	const b = $derived(BRANDS[brand ?? '']);
</script>

{#if b}
	{#if b.logo}
		<!-- borderless, square-leaning: wide wordmarks may stretch to 1.6x height -->
		<span
			class="badge"
			style:height="{height}rem"
			style:max-width="{height * 1.6}rem"
			title={b.label}
		>
			<img src={b.logo} alt={b.label} />
		</span>
	{:else}
		<span
			class="chip"
			style:width="{height * 0.85}rem"
			style:height="{height * 0.85}rem"
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
		justify-content: center;
		/* dark-ink logos need a light plate once the card goes dark;
		   --plate is transparent in the light theme */
		padding: var(--plate-pad);
		border-radius: 4px;
		background: var(--plate);
	}
	.badge img {
		display: block;
		height: 100%;
		width: auto;
		max-width: 100%;
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
