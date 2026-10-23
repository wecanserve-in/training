import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

// After a new deploy, an open tab may ask for page files that no longer exist.
// Reload once to pick up the new version instead of showing a blank page.
window.addEventListener("vite:preloadError", (event) => {
  try {
    const lastReload = Number(sessionStorage.getItem("chunk-reload-at") || 0);
    if (Date.now() - lastReload < 10000) return;
    sessionStorage.setItem("chunk-reload-at", String(Date.now()));
  } catch {
    // Storage blocked: still try one reload.
  }
  event.preventDefault();
  window.location.reload();
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
