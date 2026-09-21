import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource-variable/cairo';
import '@fontsource/amiri-quran/arabic-400.css';
import '@fontsource/noto-naskh-arabic/arabic-400.css';
import '@fontsource/noto-naskh-arabic/arabic-600.css';
import { App } from './app/App';
import './styles/global.css';

declare global {
  interface Window {
    Capacitor?: { isNativePlatform?: () => boolean };
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

const isNativeShell = window.Capacitor?.isNativePlatform?.() ?? false;

if ('serviceWorker' in navigator && !isNativeShell) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // يعمل التطبيق بدون Service Worker، لكن Offline سيكون أقل.
    });
  });
}
