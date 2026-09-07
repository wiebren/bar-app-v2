import PocketBase, { type RecordModel } from 'pocketbase';
import { PUBLIC_PB_URL } from '$env/static/public';

// authStore persists in localStorage; with the 1-year token duration set on the
// users collection this gives the "stay logged in" behaviour of the old app.
export const pb = new PocketBase(PUBLIC_PB_URL);

export function currentUser(): RecordModel | null {
	return pb.authStore.record;
}

export function isAdmin(): boolean {
	return pb.authStore.record?.role === 'admin';
}

let settingsCache: RecordModel | null = null;

export async function getSettings(): Promise<RecordModel> {
	if (!settingsCache) {
		const list = await pb.collection('settings').getList(1, 1);
		settingsCache = list.items[0];
	}
	return settingsCache;
}

export function invalidateSettings() {
	settingsCache = null;
}

export async function getActiveParties(): Promise<RecordModel[]> {
	return await pb.collection('parties').getFullList({
		filter: 'ends > @now',
		sort: 'created',
		expand: 'host'
	});
}

export function displayName(u: { [key: string]: unknown }): string {
	return [u.first_name, u.infix, u.last_name].filter(Boolean).join(' ') as string;
}

export function euro(amount: number): string {
	return '€' + (amount ?? 0).toFixed(2).replace('.', ',');
}
