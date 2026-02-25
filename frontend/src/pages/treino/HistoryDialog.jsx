import { useState, useEffect, useRef } from "react";
import {
  Box, Typography, Button, Stack, CircularProgress,
  Dialog, DialogContent, DialogTitle, DialogActions,
  Divider, IconButton, TextField, InputBase, Chip, MenuItem, Collapse,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import EditIcon from "@mui/icons-material/Edit";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import SearchIcon from "@mui/icons-material/Search";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import RemoveIcon from "@mui/icons-material/Remove";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
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

/* ─── Dialog para adicionar exercício ─── */
function AddEntryDialog({ open, onClose, machines: machinesProp, onSave, saving, onMachineCreated }) {
  const [step,       setStep]       = useState("pick");
  const [search,     setSearch]     = useState("");
  const [filter,     setFilter]     = useState("Todos");
  const [selMach,    setSelMach]    = useState(null);
  const [series,     setSeries]     = useState([{ weight: "", reps: "" }]);
  const [machines,   setMachines]   = useState(machinesProp || []);
  const [showCreate, setShowCreate] = useState(false);
  const [newName,    setNewName]    = useState("");
  const [newCat,     setNewCat]     = useState("");
  const [creating,   setCreating]   = useState(false);

  useEffect(() => { setMachines(machinesProp || []); }, [machinesProp]);

  // reset when opened (key prop also forces remount, this is a safety net)
  useEffect(() => {
    if (open) {
      setStep("pick"); setSearch(""); setFilter("Todos");
      setSelMach(null); setSeries([{ weight: "", reps: "" }]);
    }
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
      setSeries([{ weight: "", reps: "" }]);
      setStep("enter");
    } finally {
      setCreating(false);
    }
  }

  function handleSave() {
    const validSeries = series.filter((s) => s.weight !== "" && s.weight != null);
    if (!validSeries.length) return;
    const setsData = validSeries.map((s) => ({
      weight: parseFloat(s.weight) || 0,
      reps:   parseInt(s.reps)     || 1,
    }));
    const maxWeight = Math.max(...setsData.map((s) => s.weight));
    const avgReps   = Math.round(setsData.reduce((a, s) => a + s.reps, 0) / setsData.length);
    onSave({ machineId: selMach.id, weight: maxWeight, sets: setsData.length, reps: avgReps, setsData });
  }

  return (
    <>
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm"
        PaperProps={{ sx: { bgcolor: "#071a12", backgroundImage: "none", borderRadius: 2 } }}>
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
            <Box sx={{ px: 2, mb: 1 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 1.5, py: 0.8, borderRadius: 2.5,
                bgcolor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)",
                "&:focus-within": { border: "1px solid rgba(34,197,94,0.35)" } }}>
                <SearchIcon sx={{ fontSize: 18, color: "rgba(255,255,255,0.3)" }} />
                <InputBase placeholder="Pesquisar..." value={search} onChange={(e) => setSearch(e.target.value)}
                  fullWidth sx={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.85)" }} />
              </Box>
            </Box>
            <Box data-no-swipe sx={{ px: 2, pb: 1, display: "flex", flexWrap: "wrap", gap: 0.5 }}>
              {categories.map((c) => (
                <Chip key={c} label={c} size="small" clickable onClick={() => setFilter(c)}
                  sx={{ fontSize: "0.72rem", height: 26,
                    bgcolor: filter === c ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.06)",
                    color:   filter === c ? "#22c55e" : "rgba(255,255,255,0.6)",
                    border:  filter === c ? "1px solid rgba(34,197,94,0.3)" : "1px solid transparent" }} />
              ))}
            </Box>
            <Box sx={{ px: 2, pb: 2, overflowY: "auto", maxHeight: "50vh", position: "relative" }}>
              <Stack spacing={0.8} sx={{ pb: 7 }}>
                {filtered.map((m) => (
                  <Box key={m.id} onClick={() => { setSelMach(m); setSeries([{ weight: "", reps: "" }]); setStep("enter"); }}
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
          /* ── Etapa de registro das séries ── */
          <Box sx={{ px: 2.5, pt: 0.5, pb: 2.5 }}>
            <Stack spacing={0.8} mb={1.5}>
              {series.map((s, i) => (
                <Stack key={i} direction="row" spacing={1} alignItems="center">
                  <Typography fontSize="0.72rem" color="rgba(255,255,255,0.4)" fontWeight={700}
                    sx={{ minWidth: 52, flexShrink: 0 }}>
                    Série {i + 1}
                  </Typography>
                  <TextField
                    label="Kg" type="number"
                    value={s.weight}
                    autoFocus={i === 0 && series.length === 1}
                    onChange={(e) => setSeries((prev) => prev.map((s2, j) => j !== i ? s2 : { ...s2, weight: e.target.value }))}
                    size="small" sx={{ flex: 1 }}
                    inputProps={{ min: 0, step: 0.5 }}
                  />
                  <TextField
                    label="Reps" type="number"
                    value={s.reps}
                    onChange={(e) => setSeries((prev) => prev.map((s2, j) => j !== i ? s2 : { ...s2, reps: e.target.value }))}
                    size="small" sx={{ flex: 1 }}
                    inputProps={{ min: 1, step: 1 }}
                  />
                  {series.length > 1 && (
                    <IconButton size="small"
                      onClick={() => setSeries((prev) => prev.filter((_, j) => j !== i))}
                      sx={{ color: "rgba(255,255,255,0.3)", flexShrink: 0, "&:hover": { color: "rgba(239,68,68,0.7)" } }}>
                      <RemoveIcon fontSize="small" />
                    </IconButton>
                  )}
                </Stack>
              ))}
            </Stack>

            <Button fullWidth variant="outlined" startIcon={<AddIcon />}
              onClick={() => setSeries((prev) => [...prev, {
                weight: prev[prev.length - 1]?.weight ?? "",
                reps:   prev[prev.length - 1]?.reps   ?? "",
              }])}
              sx={{ mb: 2, fontWeight: 700, py: 0.9,
                borderColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.5)",
                "&:hover": { borderColor: "rgba(255,255,255,0.3)", color: "rgba(255,255,255,0.8)" } }}>
              Adicionar série
            </Button>

            <Stack spacing={1}>
              <Button variant="contained" fullWidth disabled={saving || series.every((s) => !s.weight)}
                onClick={handleSave}
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
        PaperProps={{ sx: { bgcolor: "#071a12", backgroundImage: "none", borderRadius: 2 } }}>
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
function EditSessionDialog({ session, open, onSave, saving, onDelete, onAddEntry, machines, onMachineCreated }) {
  const [entries,           setEntries]           = useState([]);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting,          setDeleting]          = useState(false);
  const [addEntryOpen,      setAddEntryOpen]      = useState(false);
  const [addEntryKey,       setAddEntryKey]       = useState(0);
  const [addEntrySaving,    setAddEntrySaving]    = useState(false);

  // ── Drag-to-reorder ──────────────────────────────────────────────────────
  const dragRef        = useRef({ active: false });
  const stateRef       = useRef({});
  const cardRefs       = useRef([]);
  const draggedElemRef = useRef(null);
  const [draggingIdx,   setDraggingIdx]   = useState(-1);
  const [dropTargetIdx, setDropTargetIdx] = useState(-1);

  stateRef.current = { entries };

  useEffect(() => {
    function onMove(e) {
      if (!dragRef.current.active) return;
      e.preventDefault();
      const dy = e.clientY - dragRef.current.startY;
      // Direct DOM manipulation for smooth drag (no React re-render on every move)
      if (draggedElemRef.current) {
        draggedElemRef.current.style.transform = `translateY(${dy}px) scale(1.02)`;
      }
      const { fromIdx, cardMidpoints, count } = dragRef.current;
      let newHover = fromIdx;
      for (let i = 0; i < count; i++) {
        if (i === fromIdx) continue;
        if (i < fromIdx && e.clientY < cardMidpoints[i]) { newHover = i; break; }
        if (i > fromIdx && e.clientY > cardMidpoints[i]) newHover = i;
      }
      newHover = Math.max(0, Math.min(count - 1, newHover));
      if (newHover !== dragRef.current.hoverIdx) {
        dragRef.current.hoverIdx = newHover;
        setDropTargetIdx(newHover);
      }
    }
    function onUp() {
      if (!dragRef.current.active) return;
      const { fromIdx, hoverIdx } = dragRef.current;
      // Reset direct DOM styles before React re-render
      if (draggedElemRef.current) {
        draggedElemRef.current.style.transform = "";
        draggedElemRef.current.style.willChange = "";
        draggedElemRef.current = null;
      }
      dragRef.current = { active: false };
      setDraggingIdx(-1); setDropTargetIdx(-1);
      if (hoverIdx >= 0 && hoverIdx !== fromIdx) {
        const list = [...stateRef.current.entries];
        const [removed] = list.splice(fromIdx, 1);
        list.splice(hoverIdx, 0, removed);
        setEntries(list);
      }
    }
    document.addEventListener("pointermove", onMove, { passive: false });
    document.addEventListener("pointerup",   onUp);
    document.addEventListener("pointercancel", onUp);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup",   onUp);
      document.removeEventListener("pointercancel", onUp);
    };
  }, []);

  function onDragHandleDown(e, idx) {
    e.preventDefault();
    e.stopPropagation();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
    const midpoints = cardRefs.current.map((el) => {
      if (!el) return 0;
      const r = el.getBoundingClientRect();
      return (r.top + r.bottom) / 2;
    });
    dragRef.current = { active: true, fromIdx: idx, hoverIdx: idx, startY: e.clientY, cardMidpoints: midpoints, count: stateRef.current.entries.length };
    // Store direct ref for smooth DOM manipulation
    draggedElemRef.current = cardRefs.current[idx];
    if (draggedElemRef.current) {
      draggedElemRef.current.style.willChange = "transform";
    }
    setDraggingIdx(idx);
    setDropTargetIdx(idx);
  }
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!session || session._empty) { setEntries([]); return; }
    setEntries(session.entries.map((e) => {
      let sd = e.setsData;
      if (typeof sd === "string") { try { sd = JSON.parse(sd); } catch { sd = null; } }
      const setsArr = Array.isArray(sd) && sd.length > 0
        ? sd.map((s) => ({ weight: s.weight ?? e.weight, reps: s.reps ?? e.reps }))
        : Array.from({ length: e.sets || 1 }, () => ({ weight: e.weight, reps: e.reps }));
      return { id: e.id, machine: e.machine, comment: e.comment || "", sets: setsArr };
    }));
  }, [session?.id]);

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

  function addSet(ei) {
    setEntries((prev) => prev.map((ent, i) => i !== ei ? ent : {
      ...ent,
      sets: [...ent.sets, {
        weight: ent.sets[ent.sets.length - 1]?.weight ?? null,
        reps:   ent.sets[ent.sets.length - 1]?.reps   ?? null,
      }],
    }));
  }

  function removeSet(ei, si) {
    if (entries[ei].sets.length <= 1) return;
    setEntries((prev) => prev.map((ent, i) => i !== ei ? ent : {
      ...ent,
      sets: ent.sets.filter((_, j) => j !== si),
    }));
  }

  async function handleAddEntryToSession(data) {
    if (!session || !onAddEntry) return;
    setAddEntrySaving(true);
    try {
      const newEntry = await onAddEntry(session.id, data);
      if (newEntry) {
        let sd = newEntry.setsData;
        if (typeof sd === "string") { try { sd = JSON.parse(sd); } catch { sd = null; } }
        const setsArr = Array.isArray(sd) && sd.length > 0
          ? sd.map((s) => ({ weight: s.weight ?? newEntry.weight, reps: s.reps ?? newEntry.reps }))
          : Array.from({ length: newEntry.sets || 1 }, () => ({ weight: newEntry.weight, reps: newEntry.reps }));
        const newLocal = { id: newEntry.id, machine: newEntry.machine, comment: newEntry.comment || "", sets: setsArr };
        const updatedEntries = [...entries, newLocal];
        setEntries(updatedEntries);
        setAddEntryOpen(false);
        await onSave(updatedEntries);
      } else {
        setAddEntryOpen(false);
      }
    } finally {
      setAddEntrySaving(false);
    }
  }

  async function handleDelete() {
    if (!onDelete) return;
    setDeleting(true);
    try {
      await onDelete(session.id);
      setConfirmDeleteOpen(false);
    } finally {
      setDeleting(false);
    }
  }

  if (!session || session._empty) return null;

  const dateLabel = (() => {
    const d = new Date(session.date);
    return d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" });
  })();

  return (
    <>
      <Dialog open={open} onClose={() => onSave(entries)} fullWidth maxWidth="sm"
        transitionDuration={200}
        PaperProps={{ sx: { bgcolor: "#071a12", backgroundImage: "none", borderRadius: 2, maxHeight: "90vh" } }}>

        {/* Header: [DELETE | title+date | X] */}
        <Box sx={{ px: 2, pt: 2, pb: 1, display: "flex", alignItems: "center", gap: 0.5 }}>
          {onDelete && (
            <IconButton size="small" onClick={() => setConfirmDeleteOpen(true)}
              sx={{ color: "rgba(239,68,68,0.5)", flexShrink: 0,
                "&:hover": { color: "rgba(239,68,68,0.9)", bgcolor: "rgba(239,68,68,0.08)" } }}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          )}
          <Box sx={{ flex: 1, minWidth: 0, pl: onDelete ? 0.5 : 0.5 }}>
            <Typography fontWeight={900} fontSize="1rem">Editar treino</Typography>
            <Typography variant="caption" color="text.secondary" noWrap sx={{ textTransform: "capitalize" }}>
              {dateLabel}
            </Typography>
          </Box>
          <IconButton size="small" onClick={() => onSave(entries)} disabled={saving}
            sx={{ color: "rgba(255,255,255,0.4)", flexShrink: 0 }}>
            {saving ? <CircularProgress size={18} sx={{ color: "#22c55e" }} /> : <CloseIcon fontSize="small" />}
          </IconButton>
        </Box>

        <DialogContent sx={{ px: 2.5, pt: 0.5, pb: 2, overflowY: "auto" }}>
          {entries.length === 0 ? (
            <Typography color="text.secondary" textAlign="center" py={3} fontSize="0.85rem">
              Nenhum exercício ainda. Adicione abaixo.
            </Typography>
          ) : (
            <Stack spacing={1.5} mb={1}>
              {entries.map((entry, ei) => {
                const isDragging  = draggingIdx === ei;
                const isDropTarget = !isDragging && dropTargetIdx === ei && draggingIdx >= 0;
                return (
                <Box key={entry.id}
                  ref={(el) => { cardRefs.current[ei] = el; }}
                  sx={{
                    borderRadius: 2, p: 1.5, position: "relative",
                    border: isDragging    ? "1px solid rgba(34,197,94,0.35)"
                          : isDropTarget  ? "1px solid rgba(255,255,255,0.25)"
                          :                 "1px solid rgba(255,255,255,0.08)",
                    bgcolor: isDragging ? "rgba(34,197,94,0.06)" : "rgba(255,255,255,0.02)",
                    // transform handled via draggedElemRef DOM manipulation
                    transition: isDragging ? "none" : "border 0.12s, box-shadow 0.1s",
                    boxShadow: isDragging ? "0 8px 24px rgba(0,0,0,0.5)" : "none",
                    zIndex: isDragging ? 10 : 1,
                  }}>
                  <Stack direction="row" alignItems="center" spacing={1} mb={1.2}>
                    <Box onPointerDown={(e) => onDragHandleDown(e, ei)}
                      sx={{ color: "rgba(255,255,255,0.2)", cursor: "grab", flexShrink: 0,
                        display: "flex", alignItems: "center", touchAction: "none",
                        "&:active": { cursor: "grabbing", color: "rgba(255,255,255,0.5)" } }}>
                      <DragIndicatorIcon sx={{ fontSize: 18 }} />
                    </Box>
                    <ExerciseThumbnail machine={entry.machine} size={32} />
                    <Typography fontWeight={700} fontSize="0.9rem" sx={{ flex: 1, minWidth: 0 }} noWrap>
                      {entry.machine?.name}
                    </Typography>
                  </Stack>
                  <Stack spacing={0.7}>
                    {entry.sets.map((s, si) => (
                      <Stack key={si} direction="row" spacing={1} alignItems="center">
                        <Typography fontSize="0.7rem" color="rgba(255,255,255,0.3)" fontWeight={700}
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
                        {entry.sets.length > 1 && (
                          <IconButton size="small" onClick={() => removeSet(ei, si)}
                            sx={{ color: "rgba(255,255,255,0.2)", flexShrink: 0,
                              "&:hover": { color: "rgba(239,68,68,0.7)", bgcolor: "rgba(239,68,68,0.08)" } }}>
                            <RemoveIcon fontSize="small" />
                          </IconButton>
                        )}
                      </Stack>
                    ))}
                  </Stack>
                  <Button size="small" startIcon={<AddIcon sx={{ fontSize: "0.85rem !important" }} />}
                    onClick={() => addSet(ei)}
                    sx={{ mt: 0.8, fontSize: "0.72rem", color: "rgba(255,255,255,0.35)", textTransform: "none",
                      "&:hover": { color: "rgba(34,197,94,0.8)" }, minWidth: 0, px: 0.5, py: 0.3 }}>
                    + Série
                  </Button>
                  <TextField label="Comentário" value={entry.comment}
                    onChange={(e) => updateComment(ei, e.target.value)}
                    fullWidth size="small" multiline maxRows={3}
                    sx={{ mt: 1 }} />
                </Box>
                );
              })}
            </Stack>
          )}

          {/* Adicionar exercício */}
          {onAddEntry && (
            <Box sx={{ display: "flex", justifyContent: "center", mt: entries.length ? 1 : 0 }}>
              <Button variant="outlined" startIcon={<AddIcon />}
                onClick={() => { setAddEntryKey((k) => k + 1); setAddEntryOpen(true); }}
                sx={{ fontWeight: 700, fontSize: "0.85rem", textTransform: "none",
                  borderColor: "rgba(255,255,255,0.18)", color: "rgba(255,255,255,0.65)",
                  px: 3, py: 1, borderRadius: 2.5,
                  "&:hover": { borderColor: "rgba(255,255,255,0.35)", bgcolor: "rgba(255,255,255,0.04)" } }}>
                Adicionar exercício
              </Button>
            </Box>
          )}
        </DialogContent>

        {/* Footer */}
        <Box sx={{ px: 2.5, pb: 2.5, pt: 0.5 }}>
          <Button variant="contained" fullWidth disabled={saving} onClick={() => onSave(entries)}
            sx={{ py: 1.2, fontWeight: 800, borderRadius: "8px",
              bgcolor: "#22c55e", color: "#000",
              "&:hover": { bgcolor: "#16a34a" },
              "&.Mui-disabled": { bgcolor: "rgba(34,197,94,0.3)", color: "rgba(0,0,0,0.4)" } }}>
            {saving ? <CircularProgress size={18} sx={{ color: "#000" }} /> : "Salvar"}
          </Button>
        </Box>
      </Dialog>

      {/* Confirm delete */}
      <Dialog open={confirmDeleteOpen} onClose={() => setConfirmDeleteOpen(false)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { bgcolor: "#071a12", backgroundImage: "none", borderRadius: 2 } }}>
        <DialogTitle sx={{ fontWeight: 900 }}>Excluir treino?</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary" fontSize="0.9rem">
            Isso vai apagar a sessão inteira. Não pode ser desfeito.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setConfirmDeleteOpen(false)}
            sx={{ color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>
            Cancelar
          </Button>
          <Button variant="contained" disabled={deleting} onClick={handleDelete}
            sx={{ bgcolor: "#ef4444", "&:hover": { bgcolor: "#dc2626" }, fontWeight: 700, borderRadius: "8px" }}>
            {deleting ? <CircularProgress size={16} /> : "Excluir"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add entry dialog — key forces remount on every open (fixes flash bug) */}
      <AddEntryDialog
        key={addEntryKey}
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

/* ─── Dialog principal de histórico ─── */
export default function HistoryDialog({
  open, onClose, sessions, loading,
  selectedSession, onSelectSession,
  onEditSession, onCreateSession, onAddEntry,
  machines, onMachineCreated, onDeleteSession,
}) {
  const [editSessionOpen,   setEditSessionOpen]   = useState(false);
  const [editSessionSaving, setEditSessionSaving] = useState(false);
  const [creating,          setCreating]          = useState(false);
  const [expandedEntryId,   setExpandedEntryId]   = useState(null);

  // Reset expand state when a different session is selected
  useEffect(() => {
    setExpandedEntryId(null);
  }, [selectedSession?.id ?? selectedSession?.date]);

  // Clicar num dia → mostra detalhes; editor só abre ao clicar no lápis
  function handleCalendarSelect(sess) {
    onSelectSession(sess);
  }

  // Criar treino no dia vazio → após criar, abre o editor
  async function handleCreate() {
    if (!selectedSession?._empty || !onCreateSession) return;
    setCreating(true);
    try {
      await onCreateSession(selectedSession.date);
      setEditSessionOpen(true);
    } finally {
      setCreating(false);
    }
  }

  // Auto-save ao fechar EditSessionDialog (X button)
  async function handleSaveSession(editedEntries) {
    if (!selectedSession || selectedSession._empty || !onEditSession) {
      setEditSessionOpen(false);
      return;
    }
    setEditSessionSaving(true);
    try {
      for (let i = 0; i < editedEntries.length; i++) {
        const entry = editedEntries[i];
        const validSets = entry.sets.filter((s) => s.weight != null && s.weight > 0);
        const maxWeight = validSets.length > 0 ? Math.max(...validSets.map((s) => s.weight)) : null;
        const maxReps   = entry.sets.length   > 0 ? Math.max(...entry.sets.map((s) => s.reps || 0)) : null;
        await onEditSession(selectedSession.id, entry.id, {
          ...(maxWeight != null && { weight: maxWeight }),
          ...(maxReps   != null && { reps:   maxReps   }),
          sets:      entry.sets.length,
          setsData:  entry.sets,
          comment:   entry.comment || null,
          sortOrder: i,
        });
      }
    } finally {
      setEditSessionSaving(false);
      setEditSessionOpen(false);
    }
  }

  // Deletar sessão → mantém o dia selecionado como _empty para sumir a bolinha e mostrar "Criar treino"
  async function handleDeleteSession(sessionId) {
    if (!onDeleteSession) return;
    const deletedDate = selectedSession?.date;
    await onDeleteSession(sessionId);
    setEditSessionOpen(false);
    onSelectSession(deletedDate
      ? { _empty: true, date: deletedDate, entries: [] }
      : null
    );
  }

  // Wrapper que retorna o entry criado (para EditSessionDialog atualizar a lista local)
  async function handleAddEntryProxy(sessionId, data) {
    if (!onAddEntry) return null;
    return await onAddEntry(sessionId, data);
  }

  return (
    <>
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm"
        PaperProps={{ sx: { bgcolor: "#071a12", backgroundImage: "none", borderRadius: 2, maxHeight: "90vh" } }}>
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
                onSelect={handleCalendarSelect}
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
                            sx={{ fontWeight: 700, fontSize: "0.82rem",
                              borderColor: "rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.6)",
                              "&:hover": { borderColor: "rgba(255,255,255,0.4)" } }}>
                            {creating
                              ? <><CircularProgress size={14} sx={{ mr: 1 }} />Criando...</>
                              : "Criar treino para este dia"}
                          </Button>
                        )}
                      </>
                    );
                  })()}
                </Box>
              ) : selectedSession ? (
                /* ── Detalhes da sessão (read-only) ── */
                <Box>
                  {(() => {
                    const d       = new Date(selectedSession.date);
                    const dow2    = DAYS[d.getDay()];
                    const dateStr = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
                    const prs     = selectedSession.entries.filter((e) => e.hitPR).length;
                    return (
                      <>
                        {/* Cabeçalho estático + lápis */}
                        <Box sx={{ mb: 1.5, borderRadius: 2, p: 1.2,
                            bgcolor: "rgba(255,255,255,0.02)",
                            border: "1px solid rgba(255,255,255,0.06)" }}>
                          <Stack direction="row" alignItems="center">
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography fontWeight={800} fontSize="0.9rem">{dow2}, {dateStr}</Typography>
                              <Stack direction="row" spacing={0.8} alignItems="center" flexWrap="wrap" mt={0.2}>
                                <Typography variant="caption" color="text.secondary">
                                  {selectedSession.entries.length} exercício{selectedSession.entries.length !== 1 ? "s" : ""}
                                  {selectedSession.duration > 0 ? ` · ${formatDuration(selectedSession.duration)}` : ""}
                                </Typography>
                                {prs > 0 && (
                                  <Stack direction="row" alignItems="center" spacing={0.3}>
                                    <EmojiEventsIcon sx={{ fontSize: 12, color: "#facc15" }} />
                                    <Typography variant="caption" sx={{ color: "#facc15", fontWeight: 700 }}>
                                      {prs} PR{prs > 1 ? "s" : ""}
                                    </Typography>
                                  </Stack>
                                )}
                              </Stack>
                            </Box>
                            {onEditSession && (
                              <IconButton size="small"
                                onClick={() => setEditSessionOpen(true)}
                                sx={{ color: "rgba(255,255,255,0.3)",
                                  "&:hover": { color: "rgba(255,255,255,0.7)" }, p: 0.5 }}>
                                <EditIcon sx={{ fontSize: 16 }} />
                              </IconButton>
                            )}
                          </Stack>
                        </Box>

                        {/* Lista de exercícios — cada um tem seta própria */}
                        <Stack spacing={0.5} sx={{ pb: 0.5 }}>
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

                              const isFirstTime = e.hitPR && e.previousPR === null;
                              const isExpEntry  = expandedEntryId === e.id;
                              const hasDetails  = (realSets && realSets.length > 0) || !!e.comment;
                              return (
                                <Box key={e.id} sx={{ borderRadius: 2,
                                  bgcolor: "rgba(255,255,255,0.03)",
                                  border: `1px solid ${isFirstTime ? "rgba(250,204,21,0.2)" : "rgba(255,255,255,0.06)"}` }}>
                                  <Stack direction="row" alignItems="center" spacing={1}
                                    onClick={() => hasDetails && setExpandedEntryId(isExpEntry ? null : e.id)}
                                    sx={{ px: 1.5, py: 0.8, cursor: hasDetails ? "pointer" : "default" }}>
                                    <ExerciseThumbnail machine={e.machine} size={36} />
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                      <Stack direction="row" alignItems="center" spacing={0.7}>
                                        <Typography fontSize="0.82rem" fontWeight={700} noWrap>{e.machine?.name}</Typography>
                                        {isFirstTime && (
                                          <Box sx={{ px: 0.8, py: 0.1, borderRadius: 1,
                                            bgcolor: "rgba(250,204,21,0.15)", border: "1px solid rgba(250,204,21,0.3)", flexShrink: 0 }}>
                                            <Typography fontSize="0.58rem" fontWeight={800} color="#facc15" letterSpacing="0.03em">
                                              1ª vez
                                            </Typography>
                                          </Box>
                                        )}
                                      </Stack>
                                      <Stack direction="row" spacing={0.8} alignItems="center">
                                        <Typography variant="caption" color="text.secondary">{e.sets}×{e.reps}</Typography>
                                        {exMins != null && exMins > 0 && exMins < 120 && (
                                          <Typography variant="caption" color="rgba(255,255,255,0.28)">~{exMins}min</Typography>
                                        )}
                                      </Stack>
                                    </Box>
                                    <Stack direction="row" alignItems="center" spacing={0.3} sx={{ flexShrink: 0 }}>
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
                                      {hasDetails && (
                                        <Box sx={{ color: "rgba(255,255,255,0.25)", display: "flex", alignItems: "center" }}>
                                          {isExpEntry
                                            ? <ExpandLessIcon sx={{ fontSize: 16 }} />
                                            : <ExpandMoreIcon sx={{ fontSize: 16 }} />}
                                        </Box>
                                      )}
                                    </Stack>
                                  </Stack>
                                  <Collapse in={isExpEntry} timeout={180}>
                                    <Box sx={{ px: 1.5, pb: 1 }}>
                                      {realSets && realSets.length > 0 && (
                                        <Stack direction="row" spacing={0.8} mt={0.5} flexWrap="wrap">
                                          {realSets.map((s, si) => (
                                            <Typography key={si} variant="caption" color="rgba(255,255,255,0.3)" fontSize="0.68rem">
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
                                  </Collapse>
                                </Box>
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

              {sessions.length === 0 && !loading && (
                <Typography color="text.secondary" textAlign="center" py={2}>
                  Nenhum treino ainda.
                </Typography>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      <EditSessionDialog
        session={selectedSession}
        open={editSessionOpen}
        onSave={handleSaveSession}
        saving={editSessionSaving}
        onDelete={onDeleteSession ? handleDeleteSession : undefined}
        onAddEntry={onAddEntry ? handleAddEntryProxy : undefined}
        machines={machines}
        onMachineCreated={onMachineCreated}
      />
    </>
  );
}
