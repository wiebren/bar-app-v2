<script lang="ts">
	import { euro } from '$lib/pb';

	let { balance, yellowThreshold }: { balance: number; yellowThreshold: number } = $props();

	// Numeric comparison — the old app compared strings and sometimes colored wrong.
	const level = $derived(balance > yellowThreshold ? 'good' : balance > 0 ? 'warn' : 'bad');
</script>

<span class="badge {level}">{euro(balance)}</span>

<style>
	.badge {
		display: inline-block;
		padding: 0.18rem 0.6rem;
		border-radius: 999px;
		font-size: 0.88em;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
	.good {
		background: color-mix(in srgb, var(--good) 12%, transparent);
		color: var(--good);
	}
	.warn {
		background: color-mix(in srgb, var(--warn) 12%, transparent);
		color: var(--warn);
	}
	.bad {
		background: color-mix(in srgb, var(--bad) 12%, transparent);
		color: var(--bad);
	}
</style>
