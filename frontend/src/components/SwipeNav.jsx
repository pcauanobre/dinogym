import { useSwipeable } from "react-swipeable";
import { useNavigate, useLocation } from "react-router-dom";

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

  return <div {...handlers} style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>{children}</div>;
}
