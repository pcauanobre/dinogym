import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Slide,
  Typography,
  Dialog,
  DialogContent,
  DialogActions,
} from "@mui/material";

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isAndroid() {
  return /android/i.test(navigator.userAgent);
}

function isStandalone() {
  return (
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    window.navigator.standalone === true
  );
}

export default function InstallBanner() {
  const platform = useMemo(() => {
    if (isIos()) return "ios";
    if (isAndroid()) return "android";
    return "desktop";
  }, []);

  const platformLabel = useMemo(() => {
    if (platform === "ios") return "iOS";
    if (platform === "android") return "Android";
    return "PC";
  }, [platform]);

  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [bannerOpen, setBannerOpen] = useState(true);
  const [iosHelpOpen, setIosHelpOpen] = useState(false);

  useEffect(() => {
    const check = () => setIsInstalled(isStandalone());
    check();
    const mq = window.matchMedia?.("(display-mode: standalone)");
    if (mq?.addEventListener) mq.addEventListener("change", check);
    else if (mq?.addListener) mq.addListener(check);
    return () => {
      if (mq?.removeEventListener) mq.removeEventListener("change", check);
      else if (mq?.removeListener) mq.removeListener(check);
    };
  }, []);

  useEffect(() => {
    const onBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    const onAppInstalled = () => {
      setDeferredPrompt(null);
      setIsInstalled(true);
      setBannerOpen(false);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  async function onInstall() {
    if (platform === "ios") {
      setIosHelpOpen(true);
      return;
    }
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setBannerOpen(false);
  }

  const shouldShow =
    bannerOpen && !isInstalled && (platform === "ios" || Boolean(deferredPrompt));

  if (!shouldShow) return null;

  return (
    <>
      <Slide direction="up" in={shouldShow} mountOnEnter unmountOnExit>
        <Box sx={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 2000, p: 2 }}>
          <Box
            sx={{
              mx: "auto",
              maxWidth: 520,
              borderRadius: "8px",
              border: "1px solid rgba(255,255,255,0.10)",
              bgcolor: "#050B1D",
              px: 2,
              py: 1.5,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 2,
              boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
            }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 800, fontSize: 14 }}>
                Instalar DinoGym
              </Typography>
              <Typography
                sx={{ fontSize: 12, color: "rgba(255,255,255,0.60)", mt: 0.25, lineHeight: 1.25 }}
              >
                Detectado: {platformLabel}.
              </Typography>
            </Box>

            <Box sx={{ display: "flex", gap: 1, flexShrink: 0 }}>
              <Button
                onClick={() => setBannerOpen(false)}
                sx={{
                  fontSize: 12, px: 2, py: 1, borderRadius: "8px",
                  bgcolor: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.10)",
                  color: "rgba(255,255,255,0.85)",
                  "&:hover": { bgcolor: "rgba(255,255,255,0.10)" },
                }}
              >
                Agora não
              </Button>
              <Button
                onClick={onInstall}
                sx={{
                  fontSize: 12, px: 2, py: 1, borderRadius: "8px", fontWeight: 900,
                  color: "#050B1D", bgcolor: "#22c55e",
                  "&:hover": { bgcolor: "#16a34a" },
                }}
              >
                {platform === "ios" ? "Ver passos" : "Instalar"}
              </Button>
            </Box>
          </Box>
        </Box>
      </Slide>

      <Dialog
        open={iosHelpOpen}
        onClose={() => setIosHelpOpen(false)}
        PaperProps={{
          sx: {
            borderRadius: "12px",
            bgcolor: "rgba(5, 11, 29, 0.96)",
            border: "1px solid rgba(255,255,255,0.10)",
            backdropFilter: "blur(12px)",
            color: "white",
            maxWidth: 420,
            width: "calc(100% - 32px)",
          },
        }}
      >
        <DialogContent sx={{ pt: 2.5 }}>
          <Typography sx={{ fontWeight: 900, fontSize: 16 }}>
            Instalar no iPhone (iOS)
          </Typography>
          <Typography sx={{ mt: 1, fontSize: 13, color: "rgba(255,255,255,0.75)" }}>
            Siga estes passos no <b>Safari</b>:
          </Typography>
          <Box sx={{ mt: 2, display: "grid", gap: 1.25 }}>
            {[
              { t: "1) Abra no Safari", d: "No iOS, a instalação funciona apenas no Safari." },
              { t: "2) Toque em 'Compartilhar'", d: "Ícone de quadrado com seta pra cima." },
              { t: "3) 'Adicionar à Tela de Início'", d: "Pronto — vai abrir como app." },
            ].map((s) => (
              <Box
                key={s.t}
                sx={{
                  p: 1.25, borderRadius: "10px",
                  bgcolor: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <Typography sx={{ fontWeight: 800, fontSize: 13 }}>{s.t}</Typography>
                <Typography sx={{ fontSize: 12, color: "rgba(255,255,255,0.65)" }}>{s.d}</Typography>
              </Box>
            ))}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button
            onClick={() => setIosHelpOpen(false)}
            fullWidth
            sx={{
              py: 1.1, borderRadius: "8px", fontWeight: 900,
              color: "#050B1D", bgcolor: "#22c55e",
              "&:hover": { bgcolor: "#16a34a" },
            }}
          >
            Entendi
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
