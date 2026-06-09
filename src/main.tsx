import * as React from 'react';
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

createRoot(document.getElementById("root")!).render(<App />);

// Service Worker для PWA — стабильная регистрация (нужна для установки приложения)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}