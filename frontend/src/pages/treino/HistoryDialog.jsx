import { useState, useEffect } from "react";
import {
  Box, Typography, Button, Stack, CircularProgress,
  Dialog, DialogContent, DialogTitle, DialogActions,
  Divider, IconButton, TextField, InputBase, Chip, MenuItem,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import EditIcon from "@mui/icons-material/Edit";
import AddIcon from "@mui/icons-material/Add";
import SearchIcon from "@mui/icons-material/Search";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import RemoveIcon from "@mui/icons-material/Remove";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { DAYS, MONTHS_FULL } from "../../constants/dateLabels.js";
import { CATEGORIES } from "../../constants/categories.js";
import ExerciseThumbnail from "../../components/ExerciseThumbnail.jsx";
import api from "../../utils/api.js";

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

  const today     = new Date();
  const todayYear = today.getFullYear();
  const todayMon  = today.getMonth();
  const todayDay  = today.getDate();

  return (
    <Box>
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

      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", mb: 0.5 }}>
        {["D","S","T","Q","Q","S","S"].map((l, i) => (
          <Typography key={i} textAlign="center" fontSize="0.6rem"
            color="text.secondary" fontWeight={700}>{l}</Typography>
        ))}
      </Box>

      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 0.4 }}>
        {cells.map((day, i) => {
          if (!day) return <Box key={i} />;
          const hasSess  = !!sessionMap[day];
          const isPast   = year < todayYear
            || (year === todayYear && month < todayMon)
            || (year === todayYear && month === todayMon && day <= todayDay);
          const isClickable = hasSess || isPast;
          const isSel = selDate && selDate.getDate() === day
            && selDate.getMonth() === month && selDate.getFullYear() === year;

          function handleClick() {
            if (hasSess) { onSelect(sessionMap[day]); return; }
            if (isPast) {
              const d = new Date(year, month, day, 12, 0, 0);
              onSelect({ _empty: true, date: d.toISOString(), entries: [] });
            }
          }

          return (
            <Box key={i} sx={{ display: "flex", justifyContent: "center" }}>
              <Box onClick={handleClick}
                sx={{
                  width: 32, height: 32, borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: isClickable ? "pointer" : "default",
                  bgcolor: isSel
                    ? (hasSess ? "#22c55e" : "rgba(255,255,255,0.12)")
                    : hasSess ? "rgba(34,197,94,0.13)" : "transparent",
                  border: isSel
                    ? "none"
                    : hasSess ? "1px solid rgba(34,197,94,0.35)" : "none",
                  color: isSel
                    ? "#fff"
                    : hasSess ? "#22c55e"
                    : isPast ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.1)",
                  fontWeight: hasSess ? 800 : 400, fontSize: "0.75rem",
                  "&:hover": isClickable ? {
                    bgcolor: isSel
                      ? (hasSess ? "#16a34a" : "rgba(255,255,255,0.18)")
                      : hasSess ? "rgba(34,197,94,0.25)" : "rgba(255,255,255,0.07)",
                  } : {},
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

/* ─── Dialog para adicionar exercício a uma sessão passada ─── */
function AddEntryDialog({ open, onClose, machines: machinesProp, onSave, saving, onMachineCreated }) {
  const [step,        setStep]        = useState("pick");
  const [search,      setSearch]      = useState("");
  const [filter,      setFilter]      = useState("Todos");
  const [selMach,     setSelMach]     = useState(null);
  const [weight,      setWeight]      = useState("");
  const [sets,        setSets]        = useState("3");
  const [reps,        setReps]        = useState("12");
  const [machines,    setMachines]    = useState(machinesProp || []);
  const [showCreate,  setShowCreate]  = useState(false);
  const [newName,     setNewName]     = useState("");
  const [newCat,      setNewCat]      = useState("");
  const [creating,    setCreating]    = useState(false);

  useEffect(() => { setMachines(machinesProp || []); }, [machinesProp]);
  useEffect(() => {
    if (open) { setStep("pick"); setSearch(""); setFilter("Todos"); setSelMach(null); setWeight(""); setSets("3"); setReps("12"); }
  }, [open]);

  const categories = ["Todos", ...new Set(machines.map((m) => m.category))];
  const filtered = machines
    .filter((m) => filter === "Todos" || m.category === filter)
    .filter((m) => !search || m.name.toLowerCase().includes(search.toLowerCase()));

  async function handleCreateMachine() {
    if (!newName.trim() || !newCat) return;
    setCreating(true);
    try {
      const r = await api.post("/machines", { name: newName.trim(), category: newCat });
      const newM = r.data;
      setMachines((prev) => [...prev, newM]);
      onMachineCreated?.(newM);
      setShowCreate(false);
      setNewName(""); setNewCat("");
      setSelMach(newM);
      setStep("enter");
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm"
        PaperProps={{ sx: { bgcolor: "#0a1628", backgroundImage: "none", borderRadius: 2 } }}>
        <Box sx={{ px: 2.5, pt: 2.5, pb: 1, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Typography fontWeight={900} fontSize="1rem">
            {step === "pick" ? "Adicionar exercício" : selMach?.name}
          </Typography>
          <IconButton size="small" onClick={onClose} sx={{ color: "rgba(255,255,255,0.4)" }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        {step === "pick" ? (
          <>
            {/* Search */}
            <Box sx={{ px: 2, mb: 1 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 1.5, py: 0.8, borderRadius: 2.5,
                bgcolor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)",
                "&:focus-within": { border: "1px solid rgba(34,197,94,0.35)" } }}>
                <SearchIcon sx={{ fontSize: 18, color: "rgba(255,255,255,0.3)" }} />
                <InputBase placeholder="Pesquisar..." value={search} onChange={(e) => setSearch(e.target.value)}
                  fullWidth sx={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.85)" }} />
              </Box>
            </Box>
            {/* Category filter */}
            <Box data-no-swipe sx={{ px: 2, pb: 1, display: "flex", flexWrap: "wrap", gap: 0.5 }}>
              {categories.map((c) => (
                <Chip key={c} label={c} size="small" clickable onClick={() => setFilter(c)}
                  sx={{ fontSize: "0.72rem", height: 26,
                    bgcolor: filter === c ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.06)",
                    color:   filter === c ? "#22c55e" : "rgba(255,255,255,0.6)",
                    border:  filter === c ? "1px solid rgba(34,197,94,0.3)" : "1px solid transparent" }} />
              ))}
            </Box>
            {/* List */}
            <Box sx={{ px: 2, pb: 2, overflowY: "auto", maxHeight: "50vh", position: "relative" }}>
              <Stack spacing={0.8} sx={{ pb: 7 }}>
                {filtered.map((m) => (
                  <Box key={m.id} onClick={() => { setSelMach(m); setStep("enter"); }}
                    sx={{ display: "flex", alignItems: "center", gap: 1.5,
                      p: 1.2, borderRadius: 2.5, cursor: "pointer",
                      bgcolor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)",
                      "&:active": { opacity: 0.7 }, "&:hover": { bgcolor: "rgba(255,255,255,0.07)" } }}>
                    <ExerciseThumbnail machine={m} size={46} />
                    <Box sx={{ flex: 1 }}>
                      <Typography fontWeight={700} fontSize="0.9rem">{m.name}</Typography>
                      <Typography variant="caption" color="text.secondary">{m.category}</Typography>
                    </Box>
                    <ChevronRightIcon sx={{ color: "rgba(255,255,255,0.2)", fontSize: 16 }} />
                  </Box>
                ))}
                {filtered.length === 0 && (
                  <Typography color="text.secondary" fontSize="0.82rem" textAlign="center" py={2}>
                    Nenhum exercício encontrado.
                  </Typography>
                )}
              </Stack>
              {/* FAB: criar novo exercício */}
              <Box sx={{ position: "sticky", bottom: 8, display: "flex", justifyContent: "center", pt: 1 }}>
                <Box onClick={() => setShowCreate(true)}
                  sx={{ display: "flex", alignItems: "center", gap: 0.8, px: 2.5, py: 1.2,
                    borderRadius: 50, cursor: "pointer", bgcolor: "#22c55e",
                    boxShadow: "0 4px 16px rgba(34,197,94,0.4), 0 2px 8px rgba(0,0,0,0.4)",
                    transition: "transform 0.12s", "&:active": { transform: "scale(0.94)" } }}>
                  <AddIcon sx={{ color: "#000", fontSize: 20 }} />
                  <Typography fontWeight={800} fontSize="0.82rem" color="#000">Criar novo</Typography>
                </Box>
              </Box>
            </Box>
          </>
        ) : (
          <Box sx={{ px: 2.5, pt: 1.5, pb: 2.5 }}>
            <Stack spacing={1.5} mb={2.5}>
              <TextField label="Peso (kg)" type="number" value={weight} autoFocus
                onChange={(e) => setWeight(e.target.value)}
                size="small" fullWidth inputProps={{ min: 0, step: 0.5 }} />
              <Stack direction="row" spacing={1.5}>
                <TextField label="Séries" type="number" value={sets}
                  onChange={(e) => setSets(e.target.value)}
                  size="small" fullWidth inputProps={{ min: 1, step: 1 }} />
                <TextField label="Reps" type="number" value={reps}
                  onChange={(e) => setReps(e.target.value)}
                  size="small" fullWidth inputProps={{ min: 1, step: 1 }} />
              </Stack>
            </Stack>
            <Stack spacing={1}>
              <Button variant="contained" fullWidth disabled={saving || !weight}
                onClick={() => onSave({ machineId: selMach.id, weight: parseFloat(weight), sets: parseInt(sets) || 1, reps: parseInt(reps) || 1 })}
                sx={{ py: 1.2, fontWeight: 800 }}>
                {saving ? <CircularProgress size={16} /> : "Adicionar"}
              </Button>
              <Button variant="outlined" fullWidth onClick={() => setStep("pick")}
                sx={{ py: 1.1, fontWeight: 700, borderColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.6)" }}>
                Voltar
              </Button>
            </Stack>
          </Box>
        )}
      </Dialog>

      {/* Dialog: criar novo exercício */}
      <Dialog open={showCreate} onClose={() => setShowCreate(false)} fullWidth maxWidth="xs"
        PaperProps={{ sx: { bgcolor: "#0a1628", backgroundImage: "none", borderRadius: 2 } }}>
        <DialogTitle sx={{ fontWeight: 900 }}>Novo exercício</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={0.5}>
            <TextField label="Nome do exercício" value={newName} onChange={(e) => setNewName(e.target.value)}
              fullWidth size="small" autoFocus />
            <TextField select label="Categoria" value={newCat} onChange={(e) => setNewCat(e.target.value)}
              fullWidth size="small" SelectProps={{ MenuProps: { PaperProps: { sx: { maxHeight: 240 } } } }}>
              {CATEGORIES.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setShowCreate(false)} sx={{ color: "rgba(255,255,255,0.5)" }}>Cancelar</Button>
          <Button variant="contained" onClick={handleCreateMachine}
            disabled={creating || !newName.trim() || !newCat}>
            {creating ? <CircularProgress size={16} /> : "Criar"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

/* ─── Dialog de edição completa da sessão ─── */
function EditSessionDialog({ session, open, onClose, onSave, saving }) {
  const [entries, setEntries] = useState([]);

  // Reinicializa ao trocar de sessão
  useEffect(() => {
    if (!session) { setEntries([]); return; }
    setEntries(session.entries.map((e) => {
      let sd = e.setsData;
      if (typeof sd === "string") { try { sd = JSON.parse(sd); } catch { sd = null; } }
      const setsArr = Array.isArray(sd) && sd.length > 0
        ? sd.map((s) => ({ weight: s.weight ?? e.weight, reps: s.reps ?? e.reps }))
        : Array.from({ length: e.sets || 1 }, () => ({ weight: e.weight, reps: e.reps }));
      return {
        id:      e.id,
        machine: e.machine,
        comment: e.comment || "",
        sets:    setsArr,
      };
    }));
  }, [session?.id]);

  if (!session) return null;

  function updateSet(ei, si, field, raw) {
    const value = raw === "" ? null : field === "weight" ? parseFloat(raw) : parseInt(raw);
    setEntries((prev) => prev.map((ent, i) => i !== ei ? ent : {
      ...ent,
      sets: ent.sets.map((s, j) => j !== si ? s : { ...s, [field]: isNaN(value) ? null : value }),
    }));
  }

  function updateComment(ei, value) {
    setEntries((prev) => prev.map((ent, i) => i !== ei ? ent : { ...ent, comment: value }));
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm"
      PaperProps={{ sx: { bgcolor: "#0a1628", backgroundImage: "none", borderRadius: 2, maxHeight: "90vh" } }}>
      <Box sx={{ px: 2.5, pt: 2.5, pb: 1, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Typography fontWeight={900} fontSize="1rem">Editar treino</Typography>
        <IconButton size="small" onClick={onClose} sx={{ color: "rgba(255,255,255,0.4)" }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>
      <DialogContent sx={{ px: 2.5, pt: 0.5, pb: 1 }}>
        <Stack spacing={1.5}>
          {entries.map((entry, ei) => (
            <Box key={entry.id} sx={{ borderRadius: 2, border: "1px solid rgba(255,255,255,0.08)",
              bgcolor: "rgba(255,255,255,0.02)", p: 1.5 }}>
              <Stack direction="row" alignItems="center" spacing={1} mb={1.5}>
                <ExerciseThumbnail machine={entry.machine} size={32} />
                <Typography fontWeight={700} fontSize="0.9rem" sx={{ flex: 1, minWidth: 0 }} noWrap>
                  {entry.machine?.name}
                </Typography>
              </Stack>
              <Stack spacing={0.8}>
                {entry.sets.map((s, si) => (
                  <Stack key={si} direction="row" spacing={1} alignItems="center">
                    <Typography fontSize="0.72rem" color="rgba(255,255,255,0.3)" fontWeight={600}
                      sx={{ minWidth: 52, flexShrink: 0 }}>
                      Série {si + 1}
                    </Typography>
                    <TextField label="Kg" type="number"
                      value={s.weight ?? ""}
                      onChange={(e) => updateSet(ei, si, "weight", e.target.value)}
                      size="small" sx={{ width: 80, flexShrink: 0 }}
                      inputProps={{ min: 0, step: 0.5 }} />
                    <TextField label="Reps" type="number"
                      value={s.reps ?? ""}
                      onChange={(e) => updateSet(ei, si, "reps", e.target.value)}
                      size="small" sx={{ width: 80, flexShrink: 0 }}
                      inputProps={{ min: 1, step: 1 }} />
                  </Stack>
                ))}
              </Stack>
              <TextField label="Comentário" value={entry.comment}
                onChange={(e) => updateComment(ei, e.target.value)}
                fullWidth size="small" multiline maxRows={3}
                sx={{ mt: 1.5 }} />
            </Box>
          ))}
        </Stack>
      </DialogContent>
      <Box sx={{ px: 2.5, pb: 2.5, pt: 1, display: "flex", gap: 1 }}>
        <Button fullWidth onClick={onClose} variant="outlined"
          sx={{ py: 1.1, fontWeight: 700, borderColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.6)" }}>
          Cancelar
        </Button>
        <Button fullWidth variant="contained" disabled={saving}
          onClick={() => onSave(entries)}
          sx={{ py: 1.1, fontWeight: 800 }}>
          {saving ? <CircularProgress size={16} /> : "Salvar"}
        </Button>
      </Box>
    </Dialog>
  );
}

export default function HistoryDialog({ open, onClose, sessions, loading, selectedSession, onSelectSession, onEditSession, onCreateSession, onAddEntry, machines, onMachineCreated }) {
  const [editSessionOpen,    setEditSessionOpen]    = useState(false);
  const [editSessionSaving,  setEditSessionSaving]  = useState(false);
  const [creating,           setCreating]           = useState(false);
  const [addEntryOpen,       setAddEntryOpen]       = useState(false);
  const [addEntrySaving,     setAddEntrySaving]     = useState(false);

  async function handleAddEntryToSession(data) {
    if (!selectedSession || !onAddEntry) return;
    setAddEntrySaving(true);
    try {
      await onAddEntry(selectedSession.id, data);
      setAddEntryOpen(false);
    } finally {
      setAddEntrySaving(false);
    }
  }

  async function handleCreate() {
    if (!selectedSession?._empty || !onCreateSession) return;
    setCreating(true);
    try {
      await onCreateSession(selectedSession.date);
    } finally {
      setCreating(false);
    }
  }

  async function handleSaveSession(editedEntries) {
    if (!selectedSession || !onEditSession) return;
    setEditSessionSaving(true);
    try {
      for (const entry of editedEntries) {
        const validSets = entry.sets.filter((s) => s.weight != null && s.weight > 0);
        const maxWeight = validSets.length > 0 ? Math.max(...validSets.map((s) => s.weight)) : null;
        const maxReps   = entry.sets.length   > 0 ? Math.max(...entry.sets.map((s) => s.reps || 0)) : null;
        await onEditSession(selectedSession.id, entry.id, {
          ...(maxWeight != null && { weight: maxWeight }),
          ...(maxReps   != null && { reps:   maxReps   }),
          setsData: entry.sets,
          comment:  entry.comment || null,
        });
      }
    } finally {
      setEditSessionSaving(false);
      setEditSessionOpen(false);
    }
  }

  return (
    <>
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
              <MiniCalendar
                sessions={sessions}
                selectedSession={selectedSession}
                onSelect={onSelectSession}
              />

              <Divider sx={{ my: 2, borderColor: "rgba(255,255,255,0.07)" }} />

              {selectedSession?._empty ? (
                /* ── Dia sem treino ── */
                <Box sx={{ textAlign: "center", py: 3 }}>
                  {(() => {
                    const d       = new Date(selectedSession.date);
                    const dow2    = DAYS[d.getDay()];
                    const dateStr = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
                    return (
                      <>
                        <Typography fontWeight={800} fontSize="0.9rem" mb={0.5}>{dow2}, {dateStr}</Typography>
                        <Typography color="text.secondary" fontSize="0.82rem" mb={onCreateSession ? 2.5 : 0}>
                          Nenhum treino registrado neste dia.
                        </Typography>
                        {onCreateSession && (
                          <Button variant="outlined" disabled={creating} onClick={handleCreate}
                            sx={{ fontWeight: 700, fontSize: "0.82rem", borderColor: "rgba(255,255,255,0.2)",
                              color: "rgba(255,255,255,0.6)", "&:hover": { borderColor: "rgba(255,255,255,0.4)" } }}>
                            {creating ? <CircularProgress size={16} /> : "Criar treino para este dia"}
                          </Button>
                        )}
                      </>
                    );
                  })()}
                </Box>
              ) : selectedSession ? (
                <Box>
                  {(() => {
                    const d       = new Date(selectedSession.date);
                    const dow2    = DAYS[d.getDay()];
                    const dateStr = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
                    const prs     = selectedSession.entries.filter((e) => e.hitPR).length;
                    return (
                      <>
                        {/* Cabeçalho da sessão + botão editar */}
                        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" mb={1.5}>
                          <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" sx={{ flex: 1 }}>
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
                          {onEditSession && (
                            <IconButton size="small" onClick={() => setEditSessionOpen(true)}
                              sx={{ color: "rgba(255,255,255,0.3)", flexShrink: 0,
                                "&:hover": { color: "rgba(255,255,255,0.7)" }, p: 0.5, mt: 0.1 }}>
                              <EditIcon sx={{ fontSize: 17 }} />
                            </IconButton>
                          )}
                        </Stack>

                        {/* Lista de exercícios (somente leitura) */}
                        <Stack spacing={0.5}>
                          {(() => {
                            const entries   = selectedSession.entries;
                            const sessStart = selectedSession.startedAt ? new Date(selectedSession.startedAt) : null;
                            return entries.map((e, ei) => {
                              const isUp      = e.hitPR;
                              const isDown    = e.notes === "regrediu";
                              const entryTime = new Date(e.createdAt);
                              const prevTime  = ei === 0 ? sessStart : new Date(entries[ei - 1].createdAt);
                              const exMins    = prevTime ? Math.round((entryTime - prevTime) / 60000) : null;

                              let sd = e.setsData;
                              if (typeof sd === "string") { try { sd = JSON.parse(sd); } catch { sd = null; } }
                              const realSets = Array.isArray(sd) ? sd.filter((s) => !s.skipped) : null;

                              return (
                                <Box key={e.id} sx={{ px: 1.5, py: 0.8, borderRadius: 2,
                                  bgcolor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                                  <Stack direction="row" alignItems="center" spacing={1}>
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
                                  {/* Séries individuais */}
                                  {realSets && realSets.length > 0 && (
                                    <Stack direction="row" spacing={0.8} mt={0.5} flexWrap="wrap">
                                      {realSets.map((s, si) => (
                                        <Typography key={si} variant="caption"
                                          color="rgba(255,255,255,0.3)" fontSize="0.68rem">
                                          {si + 1}: {s.weight ?? e.weight}kg×{s.reps}{s.isBackOff ? " BO" : ""}
                                        </Typography>
                                      ))}
                                    </Stack>
                                  )}
                                  {e.comment && (
                                    <Typography fontSize="0.68rem" color="rgba(255,255,255,0.28)"
                                      fontStyle="italic" mt={0.4}>
                                      "{e.comment}"
                                    </Typography>
                                  )}
                                </Box>
                              );
                            });
                          })()}
                        </Stack>
                        {onAddEntry && (
                          <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
                            <Button variant="outlined" startIcon={<AddIcon />}
                              onClick={() => setAddEntryOpen(true)}
                              sx={{ fontWeight: 700, fontSize: "0.85rem", textTransform: "none",
                                borderColor: "rgba(255,255,255,0.18)", color: "rgba(255,255,255,0.65)",
                                px: 3, py: 1, borderRadius: 2.5,
                                "&:hover": { borderColor: "rgba(255,255,255,0.35)", bgcolor: "rgba(255,255,255,0.04)" } }}>
                              Adicionar exercício
                            </Button>
                          </Box>
                        )}
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

      <EditSessionDialog
        session={selectedSession}
        open={editSessionOpen}
        onClose={() => setEditSessionOpen(false)}
        onSave={handleSaveSession}
        saving={editSessionSaving}
      />

      <AddEntryDialog
        open={addEntryOpen}
        onClose={() => setAddEntryOpen(false)}
        machines={machines}
        onSave={handleAddEntryToSession}
        saving={addEntrySaving}
        onMachineCreated={onMachineCreated}
      />
    </>
  );
}
