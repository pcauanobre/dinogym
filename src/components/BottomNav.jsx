import { useState, useEffect } from "react";
import { Box, Typography, Stack } from "@mui/material";
import HomeIcon from "@mui/icons-material/Home";
import FitnessCenterIcon from "@mui/icons-material/FitnessCenter";
import BarChartIcon from "@mui/icons-material/BarChart";
import TimerIcon from "@mui/icons-material/Timer";
import { useNavigate, useLocation } from "react-router-dom";
import TimerDrawer, { getTimerRemaining } from "./TimerDrawer.jsx";

const navTabs = [
  { label: "Home",     icon: <HomeIcon />,          path: "/app" },
  { label: "Treino",   icon: <FitnessCenterIcon />, path: "/app/treino" },
  { label: "Relatório",icon: <BarChartIcon />,      path: "/app/relatorio" },
];

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const [timerOpen, setTimerOpen] = useState(false);
  const [timerRemaining, setTimerRemaining] = useState(() => getTimerRemaining());

  useEffect(() => {
    const id = setInterval(() => {
      setTimerRemaining(getTimerRemaining());
    }, 500);
    return () => clearInterval(id);
  }, []);

  function isActive(tab) {
    return tab.path === "/app"
      ? location.pathname === tab.path
      : location.pathname.startsWith(tab.path);
  }

  const timerMins = Math.floor(timerRemaining / 60);
  const timerSecs = timerRemaining % 60;
  const timerLabel = timerRemaining > 0
    ? `${timerMins}:${String(timerSecs).padStart(2, "0")}`
    : "Timer";

  return (
    <>
      <Box
        sx={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          bgcolor: "rgba(3,13,18,0.88)",
          backdropFilter: "blur(20px)",
          borderTop: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <Stack
          direction="row"
          justifyContent="space-around"
          alignItems="center"
          sx={{ maxWidth: "sm", mx: "auto", py: 1.4 }}
        >
          {navTabs.map((tab) => {
            const active = isActive(tab);
            return (
              <Box
                key={tab.path}
                onClick={() => navigate(tab.path)}
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  cursor: "pointer",
                  px: 1.5,
                  py: 0.5,
                  borderRadius: 2,
                  transition: "all 0.2s",
                  color: active ? "#22c55e" : "rgba(255,255,255,0.35)",
                  "& .MuiSvgIcon-root": { fontSize: 26, transition: "all 0.2s" },
                  "&:active": { transform: "scale(0.92)" },
                }}
              >
                {tab.icon}
                <Typography sx={{ fontSize: "0.65rem", fontWeight: active ? 700 : 500, mt: 0.3, letterSpacing: 0.2 }}>
                  {tab.label}
                </Typography>
                {active && (
                  <Box sx={{ width: 4, height: 4, borderRadius: "50%", bgcolor: "#22c55e", mt: 0.3,
                    boxShadow: "0 0 6px rgba(34,197,94,0.6)" }} />
                )}
              </Box>
            );
          })}

          {/* Timer tab */}
          <Box
            onClick={() => setTimerOpen(true)}
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              cursor: "pointer",
              px: 1.5,
              py: 0.5,
              borderRadius: 2,
              transition: "all 0.2s",
              color: timerRemaining > 0 ? "#22c55e" : "rgba(255,255,255,0.35)",
              "& .MuiSvgIcon-root": { fontSize: 26, transition: "all 0.2s" },
              "&:active": { transform: "scale(0.92)" },
            }}
          >
            <Box sx={{ position: "relative" }}>
              <TimerIcon />
              {timerRemaining > 0 && (
                <Box sx={{
                  position: "absolute", top: -6, right: -10,
                  bgcolor: "#22c55e", borderRadius: 1, px: 0.5, py: 0.1,
                  minWidth: 28,
                }}>
                  <Typography sx={{ fontSize: "0.55rem", fontWeight: 900, color: "#000",
                    fontVariantNumeric: "tabular-nums", lineHeight: 1.3, textAlign: "center" }}>
                    {timerMins}:{String(timerSecs).padStart(2, "0")}
                  </Typography>
                </Box>
              )}
            </Box>
            <Typography sx={{ fontSize: "0.65rem", fontWeight: timerRemaining > 0 ? 700 : 500,
              mt: 0.3, letterSpacing: 0.2, color: timerRemaining > 0 ? "#22c55e" : "rgba(255,255,255,0.35)" }}>
              {timerLabel}
            </Typography>
            {timerRemaining > 0 && (
              <Box sx={{ width: 4, height: 4, borderRadius: "50%", bgcolor: "#22c55e", mt: 0.3,
                boxShadow: "0 0 6px rgba(34,197,94,0.6)" }} />
            )}
          </Box>
        </Stack>
      </Box>

      <TimerDrawer open={timerOpen} onClose={() => setTimerOpen(false)} />
    </>
  );
}
