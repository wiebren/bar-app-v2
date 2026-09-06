<script lang="ts">
	import { pb, euro } from '$lib/pb';

	const sections = [
		{ href: '/admin/users', label: 'Rekeningen' },
		{ href: '/admin/products', label: 'Producten' },
		{ href: '/admin/topup', label: 'Saldo bijschrijven' },
		{ href: '/admin/payments', label: 'Betalingshistorie' },
		{ href: '/admin/sales', label: 'Verkoop & rapporten' },
		{ href: '/admin/stock', label: 'Voorraad' },
		{ href: '/admin/mail', label: 'Saldo-mails' },
		{ href: '/admin/settings', label: 'Instellingen' }
	];

	let figures = $state<{ label: string; value: string }[]>([]);
	let turnover = $state<[string, number][]>([]);

	$effect(() => {
		(async () => {
			const users = await pb.collection('users').getFullList({ fields: 'balance,active' });
			const totalBalance = users.reduce((s, u) => s + (u.balance ?? 0), 0);
			const debt = users.reduce((s, u) => s + Math.min(u.balance ?? 0, 0), 0);
			figures = [
				{ label: 'Totaal saldi', value: euro(totalBalance) },
				{ label: 'Openstaande schuld', value: euro(debt) },
				{
					label: 'Leden (actief)',
					value: `${users.length} (${users.filter((u) => u.active).length})`
				}
			];

			// turnover per fiscal year (September–August), like the old financial overview
			const orders = await pb.collection('orders').getFullList({ fields: 'created,total' });
			const byYear = new Map<string, number>();
			for (const o of orders) {
				const d = new Date(o.created);
				const startYear = d.getMonth() + 1 < 9 ? d.getFullYear() - 1 : d.getFullYear();
				const key = `${startYear} - ${startYear + 1}`;
				byYear.set(key, (byYear.get(key) ?? 0) + (o.total ?? 0));
			}
			turnover = [...byYear.entries()].sort((a, b) => b[0].localeCompare(a[0]));
		})();
	});
</script>

<h1>Beheer</h1>

<div class="figures">
	{#each figures as f (f.label)}
		<div class="figure">
			<span class="value">{f.value}</span>
			<span class="label">{f.label}</span>
		</div>
	{/each}
</div>

{#if turnover.length}
	<div class="tablewrap">
		<table>
			<thead><tr><th>Boekjaar (sep–aug)</th><th>Omzet</th></tr></thead>
			<tbody>
				{#each turnover as [year, total] (year)}
					<tr><td>{year}</td><td>{euro(total)}</td></tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}

<div class="tiles">
	{#each sections as s (s.href)}
		<a class="tile" href={s.href}>{s.label}</a>
	{/each}
</div>

<style>
	.figures {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
		gap: 0.5rem;
		margin-bottom: 1rem;
	}
	.figure {
		background: #fff;
		border-radius: 0.6rem;
		padding: 0.8rem;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
		display: flex;
		flex-direction: column;
	}
	.value {
		font-size: 1.3rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}
	.label {
		font-size: 0.8rem;
		color: #5c564e;
	}
</style>
