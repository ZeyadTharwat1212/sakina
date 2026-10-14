import { render } from 'preact';
import { App } from './app';
import { initStore } from './lib/store';
import { Capacitor } from '@capacitor/core';

if (!Capacitor.isNativePlatform() && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
}

initStore().then(() => {
  render(<App />, document.getElementById('app')!);
});
