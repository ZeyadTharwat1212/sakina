import { render } from 'preact';
import { App } from './app';
import { initStore } from './lib/store';
import { initDownloads } from './lib/audio/downloads';
import { Capacitor } from '@capacitor/core';

if (!Capacitor.isNativePlatform() && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
}

Promise.all([initStore(), initDownloads()]).then(() => {
  render(<App />, document.getElementById('app')!);
});
