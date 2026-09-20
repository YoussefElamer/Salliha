import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './app/App';
import './styles/global.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

declare global {
  interface Window {
    Capacitor?: { isNativePlatform?: () => boolean };
  }
}

const isNativeShell = window.Capacitor?.isNativePlatform?.() ?? false;

if ('serviceWorker' in navigator && !isNativeShell) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // يعمل التطبيق بدون Service Worker، لكن Offline سيكون أقل.
    });
  });
}
