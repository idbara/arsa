import { browser } from '$app/environment';

export type Theme = 'dim' | 'cupcake';

const STORAGE_KEY = 'arsa-theme';
const DEFAULT_THEME: Theme = 'dim';

function getInitialTheme(): Theme {
	if (!browser) return DEFAULT_THEME;
	const stored = localStorage.getItem(STORAGE_KEY);
	if (stored === 'dim' || stored === 'cupcake') return stored;
	return DEFAULT_THEME;
}

function applyTheme(theme: Theme) {
	if (!browser) return;
	document.documentElement.setAttribute('data-theme', theme);
	localStorage.setItem(STORAGE_KEY, theme);
}

let current: Theme = $state(getInitialTheme());

if (browser) {
	applyTheme(getInitialTheme());
}

export const theme = {
	get current() {
		return current;
	},
	toggle() {
		current = current === 'dim' ? 'cupcake' : 'dim';
		applyTheme(current);
	}
};
