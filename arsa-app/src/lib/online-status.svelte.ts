import { browser } from '$app/environment';

let isOnline = $state(browser ? navigator.onLine : true);

if (browser) {
	window.addEventListener('online', () => {
		isOnline = true;
	});
	window.addEventListener('offline', () => {
		isOnline = false;
	});
}

export const onlineStatus = {
	get isOnline() {
		return isOnline;
	}
};
