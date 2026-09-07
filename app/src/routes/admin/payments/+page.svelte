<script lang="ts">
	import { pb, displayName, euro } from '$lib/pb';
	import { downloadCsv } from '$lib/csv';
	import type { RecordModel } from 'pocketbase';

	let payments = $state<RecordModel[]>([]);

	$effect(() => {
		(async () => {
			payments = await pb.collection('payments').getFullList({
				sort: '-created',
				expand: 'user,admin'
			});
		})();
	});

	// the export keeps the full detail (time, old/new balance) that the
	// mobile-friendly table omits
	function exportCsv() {
		downloadCsv('betalingshistorie.csv', [
			['Datum', 'Tijd', 'Aangenomen door', 'Rekening', 'Saldo oud', 'Saldo nieuw', 'Bedrag'],
			...payments.map((p) => {
				const d = new Date(p.created);
				return [
					d.toLocaleDateString('nl-NL'),
					d.toLocaleTimeString('nl-NL'),
					displayName(p.expand?.admin ?? {}),
					displayName(p.expand?.user ?? {}),
					(p.balance_old ?? 0).toFixed(2),
					(p.balance_new ?? 0).toFixed(2),
					(p.amount ?? 0).toFixed(2)
				];
			})
		]);
	}
</script>

<h1>Betalingshistorie</h1>

<button class="btn" onclick={exportCsv} disabled={!payments.length}>Exporteer CSV</button>

<div class="tablewrap">
	<table>
		<thead>
			<tr><th>Datum</th><th>Rekening</th><th class="num">Bedrag</th></tr>
		</thead>
		<tbody>
			{#each payments as p (p.id)}
				<tr>
					<td>{new Date(p.created).toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: '2-digit' })}</td>
					<td class="who">
						{displayName(p.expand?.user ?? {})}
						<span class="by">door {displayName(p.expand?.admin ?? {})}</span>
					</td>
					<td class="num" class:neg={(p.amount ?? 0) < 0}>{euro(p.amount ?? 0)}</td>
				</tr>
			{:else}
				<tr><td colspan="3">Nog geen betalingen.</td></tr>
			{/each}
		</tbody>
	</table>
</div>

<style>
	.who {
		max-width: 13rem;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.by {
		display: block;
		font-size: 0.78rem;
		color: var(--muted);
	}
	.num {
		text-align: right;
		font-weight: 600;
	}
	.neg {
		color: var(--bad);
	}
</style>
