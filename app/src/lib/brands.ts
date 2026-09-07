/**
 * Brand registry for product marks: real logo where we have one
 * (static/brands/*.svg), initials chip in brand colors as fallback.
 * Keys must match the `brand` select values in the products collection.
 */
export type Brand = { label: string; color: string; fg: string; initials: string; logo?: string };

export const BRANDS: Record<string, Brand> = {
	hertog_jan: {
		label: 'Hertog Jan',
		color: '#1e3a6e',
		fg: '#f0c04a',
		initials: 'HJ',
		logo: '/brands/hertog_jan.svg'
	},
	grolsch: {
		label: 'Grolsch',
		color: '#0e7a3c',
		fg: '#ffffff',
		initials: 'G',
		logo: '/brands/grolsch.svg'
	},
	amstel: {
		label: 'Amstel',
		color: '#c8102e',
		fg: '#ffffff',
		initials: 'A',
		logo: '/brands/amstel.svg'
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
	sinas: { label: 'Sinas', color: '#f97316', fg: '#ffffff', initials: 'S' }
};
