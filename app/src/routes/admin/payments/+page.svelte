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
			<tr>
				<th>Datum</th><th>Aangenomen door</th><th>Rekening</th>
				<th>Oud</th><th>Nieuw</th><th>Bedrag</th>
			</tr>
		</thead>
		<tbody>
			{#each payments as p (p.id)}
				<tr>
					<td>{new Date(p.created).toLocaleString('nl-NL', { dateStyle: 'short', timeStyle: 'short' })}</td>
					<td>{displayName(p.expand?.admin ?? {})}</td>
					<td>{displayName(p.expand?.user ?? {})}</td>
					<td>{euro(p.balance_old ?? 0)}</td>
					<td>{euro(p.balance_new ?? 0)}</td>
					<td>{euro(p.amount ?? 0)}</td>
				</tr>
			{:else}
				<tr><td colspan="6">Nog geen betalingen.</td></tr>
			{/each}
		</tbody>
	</table>
</div>
