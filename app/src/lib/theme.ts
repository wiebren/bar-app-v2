/**
 * Per-device colour scheme. The choice is not a server setting: it lives in
 * localStorage so a shared bar tablet and a member's phone can differ.
 *
 * 'auto' deliberately stores nothing and removes `data-theme`, letting the
 * `prefers-color-scheme` blocks in the root layout decide. An explicit choice
 * stamps `data-theme` on <html>, which those blocks defer to. Keep the values
 * here in sync with the palette there and with the inline script in app.html.
 */
export type Theme = 'auto' | 'light' | 'dark';

const KEY = 'theme';

/** Status-bar colour of a docked PWA, per resolved scheme. */
const THEME_COLOR = { light: '#211d18', dark: '#16130f' };

export function storedTheme(): Theme {
	try {
		const t = localStorage.getItem(KEY);
		return t === 'light' || t === 'dark' ? t : 'auto';
	} catch {
		// private-mode Safari can throw on localStorage access
		return 'auto';
	}
}

export function systemPrefersDark(): boolean {
	return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function resolveTheme(theme: Theme): 'light' | 'dark' {
	if (theme !== 'auto') return theme;
	return systemPrefersDark() ? 'dark' : 'light';
}

/** Store the preference (if it changed) and reflect it on the document. */
export function applyTheme(theme: Theme, remember = true) {
	if (remember) {
		try {
			if (theme === 'auto') localStorage.removeItem(KEY);
			else localStorage.setItem(KEY, theme);
		} catch {
			// unwritable storage — the choice just won't survive a reload
		}
	}
	if (theme === 'auto') delete document.documentElement.dataset.theme;
	else document.documentElement.dataset.theme = theme;

	document
		.querySelector('meta[name="theme-color"]')
		?.setAttribute('content', THEME_COLOR[resolveTheme(theme)]);
}
