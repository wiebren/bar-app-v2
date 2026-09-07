/**
 * Brand registry for product tiles: color + initials mark.
 * Deliberately no trademarked logos — colors and initials only.
 * Keys must match the `brand` select values in the products collection.
 */
export type Brand = { label: string; color: string; fg: string; initials: string };

export const BRANDS: Record<string, Brand> = {
	hertog_jan: { label: 'Hertog Jan', color: '#1e3a6e', fg: '#f0c04a', initials: 'HJ' },
	grolsch: { label: 'Grolsch', color: '#0e7a3c', fg: '#ffffff', initials: 'G' },
	amstel: { label: 'Amstel', color: '#c8102e', fg: '#ffffff', initials: 'A' },
	lidl_cola: { label: 'Lidl Cola', color: '#0050aa', fg: '#ffe500', initials: 'LC' },
	coca_cola: { label: 'Coca-Cola', color: '#e4002b', fg: '#ffffff', initials: 'CC' },
	sinas: { label: 'Sinas', color: '#f97316', fg: '#ffffff', initials: 'S' }
};
