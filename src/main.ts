import { createApp } from 'vue';
import App from './App.vue';
import './style.css';

createApp(App).mount('#app');

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js').catch(() => {
      /* Offline mode is best-effort; the generator still works without it. */
    });
  });
}
