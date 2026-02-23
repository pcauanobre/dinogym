import { useState } from "react";
import {
  Box, Typography, Button, Stack, CircularProgress,
  Dialog, DialogContent, Divider, IconButton,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import RemoveIcon from "@mui/icons-material/Remove";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { DAYS, MONTHS_FULL } from "../../constants/dateLabels.js";
import ExerciseThumbnail from "../../components/ExerciseThumbnail.jsx";

/* ─── Mini calendário ─── */
function MiniCalendar({ sessions, selectedSession, onSelect }) {
  const initialDate = sessions?.length ? new Date(sessions[0].date) : new Date();
  const [calDate, setCalDate] = useState(initialDate);

  const year  = calDate.getFullYear();
  const month = calDate.getMonth();

  const sessionMap = {};
  (sessions || []).forEach((s) => {
    const d = new Date(s.date);
    if (d.getFullYear() === year && d.getMonth() === month) {
      sessionMap[d.getDate()] = s;
    }
  });

  const firstDow    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const selDate = selectedSession ? new Date(selectedSession.date) : null;

  return (
    <Box>
      {/* header mês */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
        <IconButton size="small" onClick={() => setCalDate(new Date(year, month - 1, 1))}>
          <ChevronLeftIcon fontSize="small" />
        </IconButton>
        <Typography fontWeight={700} fontSize="0.82rem">
          {MONTHS_FULL[month]} {year}
        </Typography>
        <IconButton size="small" onClick={() => setCalDate(new Date(year, month + 1, 1))}>
          <ChevronRightIcon fontSize="small" />
        </IconButton>
      </Stack>

      {/* labels dia */}
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", mb: 0.5 }}>
        {["D","S","T","Q","Q","S","S"].map((l, i) => (
          <Typography key={i} textAlign="center" fontSize="0.6rem"
            color="text.secondary" fontWeight={700}>{l}</Typography>
        ))}
      </Box>

      {/* grade */}
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 0.4 }}>
        {cells.map((day, i) => {
          if (!day) return <Box key={i} />;
          const hasSess = !!sessionMap[day];
          const isSel   = selDate && selDate.getDate() === day
            && selDate.getMonth() === month && selDate.getFullYear() === year;
          return (
            <Box key={i} sx={{ display: "flex", justifyContent: "center" }}>
              <Box onClick={() => hasSess && onSelect(sessionMap[day])}
                sx={{
                  width: 32, height: 32, borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: hasSess ? "pointer" : "default",
                  bgcolor: isSel ? "#22c55e" : hasSess ? "rgba(34,197,94,0.13)" : "transparent",
                  border:  isSel ? "none" : hasSess ? "1px solid rgba(34,197,94,0.35)" : "none",
                  color:   isSel ? "#fff" : hasSess ? "#22c55e" : "rgba(255,255,255,0.2)",
                  fontWeight: hasSess ? 800 : 400, fontSize: "0.75rem",
                  "&:hover": hasSess ? { bgcolor: isSel ? "#16a34a" : "rgba(34,197,94,0.25)" } : {},
                }}>
                {day}
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

function formatDuration(secs) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0 && m > 0) return `${h}h ${m}min`;
  if (h > 0) return `${h}h`;
  return `${m} min`;
}

export default function HistoryDialog({ open, onClose, sessions, loading, selectedSession, onSelectSession }) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm"
      PaperProps={{ sx: { bgcolor: "#0a1628", backgroundImage: "none", borderRadius: 2, maxHeight: "90vh" } }}>
      <Box sx={{ px: 2.5, pt: 2.5, pb: 1, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Typography fontWeight={900} fontSize="1rem">Histórico de treinos</Typography>
        <IconButton size="small" onClick={onClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      <DialogContent sx={{ px: 2.5, pt: 0, pb: 2 }}>
        {loading && <Box textAlign="center" py={4}><CircularProgress color="primary" /></Box>}

        {sessions && (
          <>
            {/* Calendário */}
            <MiniCalendar
              sessions={sessions}
              selectedSession={selectedSession}
              onSelect={onSelectSession}
            />

            <Divider sx={{ my: 2, borderColor: "rgba(255,255,255,0.07)" }} />

            {/* Detalhe da sessão selecionada */}
            {selectedSession ? (
              <Box>
                {(() => {
                  const d    = new Date(selectedSession.date);
                  const dow2 = DAYS[d.getDay()];
                  const dateStr = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
                  const prs  = selectedSession.entries.filter((e) => e.hitPR).length;
                  return (
                    <>
                      <Stack direction="row" alignItems="center" spacing={1} mb={1.5} flexWrap="wrap">
                        <Typography fontWeight={800} fontSize="0.9rem">{dow2}, {dateStr}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          · {selectedSession.entries.length} exercício{selectedSession.entries.length !== 1 ? "s" : ""}
                          {selectedSession.duration > 0 ? ` · ${formatDuration(selectedSession.duration)}` : ""}
                        </Typography>
                        {prs > 0 && (
                          <Stack direction="row" alignItems="center" spacing={0.3}>
                            <EmojiEventsIcon sx={{ fontSize: 13, color: "#facc15" }} />
                            <Typography variant="caption" sx={{ color: "#facc15", fontWeight: 700 }}>
                              {prs} PR{prs > 1 ? "s" : ""} batido{prs > 1 ? "s" : ""}!
                            </Typography>
                          </Stack>
                        )}
                      </Stack>
                      <Stack spacing={0.5}>
                        {(() => {
                          const entries = selectedSession.entries;
                          const sessStart = selectedSession.startedAt ? new Date(selectedSession.startedAt) : null;
                          return entries.map((e, ei) => {
                            const isUp   = e.hitPR;
                            const isDown = e.notes === "regrediu";
                            const entryTime = new Date(e.createdAt);
                            const prevTime  = ei === 0 ? sessStart : new Date(entries[ei - 1].createdAt);
                            const exMins    = prevTime ? Math.round((entryTime - prevTime) / 60000) : null;
                            return (
                              <Stack key={e.id} direction="row" alignItems="center" spacing={1}
                                sx={{ px: 1.5, py: 0.8, borderRadius: 2,
                                  bgcolor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                                <ExerciseThumbnail machine={e.machine} size={36} />
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                  <Typography fontSize="0.82rem" fontWeight={700} noWrap>{e.machine?.name}</Typography>
                                  <Stack direction="row" spacing={0.8} alignItems="center">
                                    <Typography variant="caption" color="text.secondary">{e.sets}×{e.reps}</Typography>
                                    {exMins != null && exMins > 0 && (
                                      <Typography variant="caption" color="rgba(255,255,255,0.28)">~{exMins}min</Typography>
                                    )}
                                  </Stack>
                                </Box>
                                <Box sx={{ textAlign: "right" }}>
                                  <Stack direction="row" alignItems="center" spacing={0.4} justifyContent="flex-end">
                                    <Typography fontSize="0.85rem" fontWeight={800}
                                      color={isUp ? "#22c55e" : isDown ? "#ef4444" : "rgba(255,255,255,0.5)"}>
                                      {e.weight}kg
                                    </Typography>
                                    {isUp   && <TrendingUpIcon   sx={{ fontSize: 16, color: "#22c55e" }} />}
                                    {isDown && <TrendingDownIcon sx={{ fontSize: 16, color: "#ef4444" }} />}
                                    {!isUp && !isDown && <RemoveIcon sx={{ fontSize: 16, color: "rgba(255,255,255,0.3)" }} />}
                                  </Stack>
                                  {(isUp || isDown) && e.previousPR != null && (
                                    <Typography fontSize="0.68rem" color="rgba(255,255,255,0.35)" fontWeight={600} textAlign="center">
                                      ({e.previousPR}kg)
                                    </Typography>
                                  )}
                                </Box>
                              </Stack>
                            );
                          });
                        })()}
                      </Stack>
                    </>
                  );
                })()}
              </Box>
            ) : (
              <Typography color="text.secondary" textAlign="center" py={2} fontSize="0.85rem">
                Selecione um dia no calendário.
              </Typography>
            )}

            {sessions.length === 0 && (
              <Typography color="text.secondary" textAlign="center" py={2}>
                Nenhum treino finalizado ainda.
              </Typography>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
