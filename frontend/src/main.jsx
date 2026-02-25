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
    onNeedRefresh() {
      // Nova versão detectada — reload imediato
      window.location.reload();
    },
    onOfflineReady() {},
  });

  // Recarrega quando o service worker assume o controle (nova versão ativa)
  let swRefreshing = false;
  navigator.serviceWorker?.addEventListener("controllerchange", () => {
    if (swRefreshing) return;
    swRefreshing = true;
    window.location.reload();
  });

  // Polling: checa atualizações a cada 2 min
  setInterval(() => {
    navigator.serviceWorker?.getRegistrations().then((regs) => {
      regs.forEach((r) => {
        // Manda SKIP_WAITING para o SW em espera (não o atual)
        if (r.waiting) r.waiting.postMessage({ type: "SKIP_WAITING" });
        r.update().catch(() => {});
      });
    });
  }, 2 * 60 * 1000);

  // Ao voltar da aba/minimizado, checa update
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
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
