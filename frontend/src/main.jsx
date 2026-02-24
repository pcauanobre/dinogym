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

  // Polling: checa atualizações a cada 2 min via SW update + verifica hash do index.html
  setInterval(() => {
    if (navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({ type: "SKIP_WAITING" });
    }
    navigator.serviceWorker?.getRegistrations().then((regs) => {
      regs.forEach((r) => r.update().catch(() => {}));
    });
  }, 2 * 60 * 1000);

  // Ao voltar da aba/minimizado, checa update
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      navigator.serviceWorker?.getRegistrations().then((regs) => {
        regs.forEach((r) => r.update().catch(() => {}));
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
