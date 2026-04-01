import { useState, useEffect, useRef } from "react";
import { Box, Typography, Stack, Drawer, IconButton } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopIcon from "@mui/icons-material/Stop";

const TIMER_KEY = "dg_timer_end";
const PRESETS = [
  { label: "1:00", secs: 60 },
  { label: "1:30", secs: 90 },
  { label: "2:00", secs: 120 },
  { label: "3:00", secs: 180 },
];

function requestNotifPermission() {
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }
}

function fireNotification() {
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification("DinoGym", { body: "Descanso encerrado! Hora da próxima série. 💪", icon: "/icon-192.png" });
  } else if (navigator.vibrate) {
    navigator.vibrate([300, 100, 300, 100, 600]);
  }
}

export function getTimerRemaining() {
  const end = parseInt(localStorage.getItem(TIMER_KEY) || "0");
  if (!end) return 0;
  return Math.max(0, Math.ceil((end - Date.now()) / 1000));
}

export function clearTimer() {
  localStorage.removeItem(TIMER_KEY);
}

export default function TimerDrawer({ open, onClose }) {
  const [remaining, setRemaining] = useState(() => getTimerRemaining());
  const intervalRef = useRef(null);

  useEffect(() => {
    function tick() {
      const r = getTimerRemaining();
      setRemaining(r);
      if (r === 0) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
        if (parseInt(localStorage.getItem(TIMER_KEY) || "0") > 0) {
          fireNotification();
          clearTimer();
        }
      }
    }
    intervalRef.current = setInterval(tick, 500);
    tick();
    return () => clearInterval(intervalRef.current);
  }, []);

  function startTimer(secs) {
    requestNotifPermission();
    localStorage.setItem(TIMER_KEY, String(Date.now() + secs * 1000));
    setRemaining(secs);
  }

  function stopTimer() {
    clearTimer();
    setRemaining(0);
  }

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const display = `${mins}:${String(secs).padStart(2, "0")}`;
  const isRunning = remaining > 0;

  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          bgcolor: "rgba(7,26,18,0.97)",
          backgroundImage: "none",
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          border: "1px solid rgba(255,255,255,0.07)",
          pb: "env(safe-area-inset-bottom, 0px)",
        },
      }}
    >
      <Box sx={{ px: 3, pt: 2.5, pb: 3 }}>
        {/* Header */}
        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2.5}>
          <Typography fontWeight={800} fontSize="1rem">Timer de descanso</Typography>
          <IconButton size="small" onClick={onClose} sx={{ color: "rgba(255,255,255,0.4)" }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>

        {/* Countdown display */}
        <Box sx={{ textAlign: "center", mb: 3 }}>
          <Typography
            fontWeight={900}
            fontSize="3.5rem"
            lineHeight={1}
            color={isRunning ? "#22c55e" : "rgba(255,255,255,0.2)"}
            sx={{ fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}
          >
            {display}
          </Typography>
          {isRunning && (
            <Box sx={{ mt: 1.5, display: "flex", justifyContent: "center" }}>
              <Box
                onClick={stopTimer}
                sx={{
                  display: "flex", alignItems: "center", gap: 0.5, px: 2, py: 0.8,
                  borderRadius: 2, cursor: "pointer",
                  bgcolor: "rgba(239,68,68,0.12)",
                  border: "1px solid rgba(239,68,68,0.25)",
                  "&:active": { transform: "scale(0.94)" },
                }}
              >
                <StopIcon sx={{ fontSize: 16, color: "#ef4444" }} />
                <Typography fontSize="0.8rem" fontWeight={700} color="#ef4444">Parar</Typography>
              </Box>
            </Box>
          )}
        </Box>

        {/* Presets */}
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 1.2 }}>
          {PRESETS.map((p) => (
            <Box
              key={p.secs}
              onClick={() => startTimer(p.secs)}
              sx={{
                py: 1.5, borderRadius: 2.5, textAlign: "center", cursor: "pointer",
                bgcolor: "rgba(34,197,94,0.08)",
                border: "1.5px solid rgba(34,197,94,0.22)",
                "&:active": { transform: "scale(0.92)", bgcolor: "rgba(34,197,94,0.18)" },
                transition: "all 0.12s",
              }}
            >
              <PlayArrowIcon sx={{ fontSize: 16, color: "#22c55e", display: "block", mx: "auto", mb: 0.3 }} />
              <Typography fontSize="0.88rem" fontWeight={800} color="#22c55e">{p.label}</Typography>
            </Box>
          ))}
        </Box>

        <Typography fontSize="0.7rem" color="rgba(255,255,255,0.2)" textAlign="center" mt={2}>
          Notificação ao final (requer permissão)
        </Typography>
      </Box>
    </Drawer>
  );
}
