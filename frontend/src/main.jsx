import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { theme } from "./theme.js";
import App from "./App.jsx";
import { registerSW } from "virtual:pwa-register";

if (import.meta.env.DEV && "serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    regs.forEach((r) => r.unregister());
  });
}

if (import.meta.env.PROD) {
  registerSW({
    immediate: true,
    onNeedRefresh() { window.location.reload(); },
    onOfflineReady() {},
  });

  // Recarrega quando o service worker assume o controle (nova versão ativa)
  let swRefreshing = false;
  navigator.serviceWorker?.addEventListener("controllerchange", () => {
    if (swRefreshing) return;
    swRefreshing = true;
    window.location.reload();
  });

  // Checa version.json — mais confiável que o SW sozinho
  async function checkVersion() {
    try {
      const r = await fetch(`/version.json?t=${Date.now()}`, { cache: "no-store" });
      if (!r.ok) return;
      const { version } = await r.json();
      if (version && version !== __APP_VERSION__) window.location.reload();
    } catch { /* offline */ }
  }

  // Polling: checa versão + força update do SW a cada 1 min
  setInterval(() => {
    checkVersion();
    navigator.serviceWorker?.getRegistrations().then((regs) => {
      regs.forEach((r) => {
        if (r.waiting) r.waiting.postMessage({ type: "SKIP_WAITING" });
        r.update().catch(() => {});
      });
    });
  }, 60 * 1000);

  // Ao voltar da aba/minimizado
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      checkVersion();
      navigator.serviceWorker?.getRegistrations().then((regs) => {
        regs.forEach((r) => {
          if (r.waiting) r.waiting.postMessage({ type: "SKIP_WAITING" });
          r.update().catch(() => {});
        });
      });
    }
  });
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <App />
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);
