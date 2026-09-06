<script lang="ts">
	const sections = [
		{ href: '/admin/users', label: 'Rekeningen' },
		{ href: '/admin/products', label: 'Producten' },
		{ href: '/admin/topup', label: 'Saldo bijschrijven' },
		{ href: '/admin/payments', label: 'Betalingshistorie' },
		{ href: '/admin/sales', label: 'Verkoophistorie & rapporten' },
		{ href: '/admin/stock', label: 'Voorraad' },
		{ href: '/admin/mail', label: 'Wanbetalers mailen' },
		{ href: '/admin/settings', label: 'Instellingen' }
	];
</script>

<h1>Beheer</h1>
<div class="tiles">
	{#each sections as s (s.href)}
		<a class="tile" href={s.href}>{s.label}</a>
	{/each}
</div>
