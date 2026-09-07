<script lang="ts">
	import { pb, euro } from '$lib/pb';
	import Icon from '$lib/components/Icon.svelte';

	const actions = [
		{ href: '/admin/topup', label: 'Saldo bijschrijven', icon: 'euro' },
		{ href: '/admin/stock/add', label: 'Inkoop boeken', icon: 'plus' },
		{ href: '/admin/stock/count', label: 'Voorraad tellen', icon: 'crate' }
	];

	const sections = [
		{ href: '/admin/users', label: 'Rekeningen' },
		{ href: '/admin/products', label: 'Producten' },
		{ href: '/admin/payments', label: 'Betalingshistorie' },
		{ href: '/admin/sales', label: 'Verkoop & rapporten' },
		{ href: '/admin/mail', label: 'Saldo-mails' },
		{ href: '/admin/settings', label: 'Instellingen' }
	];

	let figures = $state<{ label: string; value: string }[]>([]);

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
		})();
	});
</script>

<h1>Beheer</h1>

<div class="actions">
	{#each actions as a (a.href)}
		<a class="action" href={a.href}>
			<Icon name={a.icon} size={26} />
			{a.label}
		</a>
	{/each}
</div>

<div class="figures">
	{#each figures as f (f.label)}
		<div class="figure">
			<span class="value">{f.value}</span>
			<span class="label">{f.label}</span>
		</div>
	{/each}
</div>

<div class="tiles">
	{#each sections as s (s.href)}
		<a class="tile" href={s.href}>{s.label}</a>
	{/each}
</div>

<style>
	.actions {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 0.6rem;
		margin-bottom: 1rem;
	}
	.actions > a:first-child {
		grid-column: 1 / -1;
	}
	.figures {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
		gap: 0.5rem;
		margin-bottom: 1rem;
	}
	.figure {
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: var(--radius);
		padding: 0.9rem;
		box-shadow: var(--shadow);
		display: flex;
		flex-direction: column;
	}
	.value {
		font-size: 1.3rem;
		font-weight: 800;
		font-variant-numeric: tabular-nums;
	}
	.label {
		font-size: 0.8rem;
		color: var(--muted);
	}
</style>
