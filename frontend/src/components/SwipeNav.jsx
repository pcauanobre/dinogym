import { useSwipeable } from "react-swipeable";
import { useNavigate, useLocation } from "react-router-dom";
import { Box, Typography } from "@mui/material";
import FitnessCenterIcon from "@mui/icons-material/FitnessCenter";
import { getSimDayOffset } from "../utils/simDay.js";

const TABS = ["/app", "/app/treino", "/app/maquinas", "/app/rotina", "/app/relatorio"];

function isInsideNoSwipe(target) {
  let el = target;
  while (el) {
    if (el.dataset?.noSwipe !== undefined) return true;
    el = el.parentElement;
  }
  return false;
}

export default function SwipeNav({ children }) {
  const navigate = useNavigate();
  const location = useLocation();

  const currentIdx = TABS.findIndex(
    (t) => t === "/app" ? location.pathname === t : location.pathname.startsWith(t)
  );

  const handlers = useSwipeable({
    onSwipedLeft: (e) => {
      if (isInsideNoSwipe(e.event.target)) return;
      if (currentIdx >= 0 && currentIdx < TABS.length - 1) {
        navigate(TABS[currentIdx + 1]);
      }
    },
    onSwipedRight: (e) => {
      if (isInsideNoSwipe(e.event.target)) return;
      if (currentIdx > 0) {
        navigate(TABS[currentIdx - 1]);
      }
    },
    delta: 50,
    preventScrollOnSwipe: false,
    trackTouch: true,
    trackMouse: false,
  });

  const isOnTreino = location.pathname.startsWith("/app/treino");
  const hasActiveSession = !!localStorage.getItem(`dg_session_start_${getSimDayOffset()}`);
  const showReturn = !isOnTreino && hasActiveSession;

  return (
    <div {...handlers} style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      {children}
      {showReturn && (
        <Box
          data-no-swipe
          onClick={() => navigate("/app/treino")}
          sx={{
            position: "fixed",
            bottom: 70,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 200,
            display: "flex",
            alignItems: "center",
            gap: 1,
            px: 2.5,
            py: 1,
            borderRadius: "99px",
            bgcolor: "#22c55e",
            color: "#000",
            cursor: "pointer",
            boxShadow: "0 4px 20px rgba(34,197,94,0.45)",
            "&:active": { transform: "translateX(-50%) scale(0.96)" },
            transition: "transform 0.15s",
            userSelect: "none",
          }}
        >
          <FitnessCenterIcon sx={{ fontSize: 17 }} />
          <Typography fontWeight={800} fontSize="0.82rem" letterSpacing={0.3}>
            Voltar ao treino
          </Typography>
        </Box>
      )}
    </div>
  );
}
