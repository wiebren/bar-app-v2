/**
 * Brand registry for product marks: real logo where we have one
 * (static/brands/*.svg), initials chip in brand colors as fallback.
 * Keys must match the `brand` select values in the products collection.
 */
export type Brand = { label: string; color: string; fg: string; initials: string; logo?: string };

export const BRANDS: Record<string, Brand> = {
	hertog_jan: {
		label: 'Hertog Jan',
		color: '#a58155', // copper, sampled from the shield
		fg: '#ffffff',
		initials: 'HJ',
		logo: '/brands/hertog_jan.png'
	},
	grolsch: {
		label: 'Grolsch',
		color: '#2f6139', // sampled from the wordmark
		fg: '#ffffff',
		initials: 'G',
		logo: '/brands/grolsch.png'
	},
	amstel: {
		label: 'Amstel',
		color: '#c8102e',
		fg: '#ffffff',
		initials: 'A',
		logo: '/brands/amstel.png'
	},
	amstel_radler: {
		label: 'Amstel Radler',
		color: '#1e62ae', // sampled from the Radler script
		fg: '#ffffff',
		initials: 'AR',
		logo: '/brands/amstel_radler.jpg'
	},
	lidl_cola: {
		label: 'Lidl Cola',
		color: '#0050aa',
		fg: '#ffe500',
		initials: 'LC',
		logo: '/brands/lidl.svg'
	},
	coca_cola: {
		label: 'Coca-Cola',
		color: '#e4002b',
		fg: '#ffffff',
		initials: 'CC',
		logo: '/brands/coca_cola.svg'
	},
	fanta: {
		label: 'Fanta',
		color: '#ff8300', // sampled from the logo's orange disc
		fg: '#ffffff',
		initials: 'F',
		logo: '/brands/fanta.svg'
	},
	radler: {
		label: 'Radler',
		color: '#2470ad', // sampled from the script
		fg: '#ffffff',
		initials: 'R',
		logo: '/brands/radler.png'
	}
};
