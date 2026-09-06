<script lang="ts">
	import { euro } from '$lib/pb';

	let { balance, yellowThreshold }: { balance: number; yellowThreshold: number } = $props();

	// Numeric comparison — the old app compared strings and sometimes colored wrong.
	const level = $derived(
		balance > yellowThreshold ? 'green' : balance > 0 ? 'orange' : 'red'
	);
</script>

<span class="badge {level}">{euro(balance)}</span>

<style>
	.badge {
		display: inline-block;
		padding: 0.15rem 0.5rem;
		border-radius: 999px;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		color: #fff;
	}
	.green {
		background: #2e7d32;
	}
	.orange {
		background: #e65100;
	}
	.red {
		background: #c62828;
	}
</style>
