import { useState, useEffect, useRef } from "react";
import {
  Box, Typography, Button, Stack, CircularProgress, Container,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  IconButton, Collapse, Divider,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import FitnessCenterIcon from "@mui/icons-material/FitnessCenter";
import EditIcon from "@mui/icons-material/Edit";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import CloseIcon from "@mui/icons-material/Close";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import BookmarkAddIcon from "@mui/icons-material/BookmarkAdd";
import BookmarkIcon from "@mui/icons-material/Bookmark";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import { useLocation } from "react-router-dom";
import api from "../utils/api.js";
import { getCachedAllRoutine, getCachedMachines, cacheAllRoutine, cacheMachines, getCachedTemplates, cacheTemplates } from "../utils/offlineQueue.js";
import BottomNav from "../components/BottomNav.jsx";
import { getSimDay } from "../utils/simDay.js";
import { DAYS } from "../constants/dateLabels.js";
import { PAGE_BG } from "../constants/theme.js";
import ExerciseThumbnail from "../components/ExerciseThumbnail.jsx";

function parseReps(str) {
  const s = String(str ?? "").trim();
  const match = s.match(/^(\d+)\s*[-–]\s*(\d+)$/);
  if (match) { const lo = parseInt(match[1]), hi = parseInt(match[2]); return { reps: Math.min(lo, hi), repsMax: Math.max(lo, hi) }; }
  const n = parseInt(s);
  return { reps: isNaN(n) ? 12 : n, repsMax: null };
}
function formatReps(reps, repsMax) { return repsMax ? `${reps}-${repsMax}` : String(reps ?? ""); }

function enrichTplExercises(exercises, machines) {
  return (exercises || []).map((e) => ({
    ...e,
    machine: machines.find((m) => m.id === e.machineId) || e.machine || { id: e.machineId, name: "?", category: "" },
  }));
}

export default function Rotina() {
  const location = useLocation();
  // Inicializar do cache para evitar spinner ao navegar para a aba
  const [routine, setRoutine] = useState(() => getCachedAllRoutine());
  const [machines, setMachines] = useState(() => getCachedMachines());
  const [loading, setLoading] = useState(() => getCachedAllRoutine().length === 0 && getCachedMachines().length === 0);

  // ── Edit day ──
  const [editDow, setEditDow] = useState(null);
  const [editLabel, setEditLabel] = useState("");
  const [editExercises, setEditExercises] = useState([]);
  const [saving, setSaving] = useState(false);
  const [bulkRepsOpen, setBulkRepsOpen] = useState(false);
  const [bulkRepsValue, setBulkRepsValue] = useState("");
  const [globalBulkOpen, setGlobalBulkOpen] = useState(false);
  const [globalBulkReps, setGlobalBulkReps] = useState("");
  const [globalBulkSets, setGlobalBulkSets] = useState("");
  const [globalBulkSaving, setGlobalBulkSaving] = useState(false);

  // ── Edit individual exercise ──
  const [editExIdx, setEditExIdx] = useState(null);
  const [editExCtx, setEditExCtx] = useState("day"); // "day" | "tpl"
  const [editExSets, setEditExSets] = useState("3");
  const [editExReps, setEditExReps] = useState("12");
  const [editExPR, setEditExPR] = useState("");

  // ── Machine picker ──
  const [pickOpen, setPickOpen] = useState(false);
  const [pickCtx, setPickCtx] = useState("day"); // "day" | "tpl"
  const [pickedMachine, setPickedMachine] = useState(null);
  const [addSets, setAddSets] = useState("3");
  const [addReps, setAddReps] = useState("12");
  const [addPR, setAddPR] = useState("");
  const [setsOpen, setSetsOpen] = useState(false);

  // ── Templates ──
  const [tplPanelOpen, setTplPanelOpen] = useState(false);
  const [templates, setTemplates] = useState(() => getCachedTemplates());

  // Day template edit
  const [editTplOpen, setEditTplOpen] = useState(false);
  const [editTplId, setEditTplId] = useState(null);
  const [editTplName, setEditTplName] = useState("");
  const [editTplExercises, setEditTplExercises] = useState([]);

  // Apply
  const [applyTpl, setApplyTpl] = useState(null);
  const [applyTplDow, setApplyTplDow] = useState(null);
  const [applyTplSaving, setApplyTplSaving] = useState(false);

  const [tplSavedFeedback, setTplSavedFeedback] = useState(false);

  // ── Vincular com amigo ──
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkEmail, setLinkEmail] = useState("");
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkError, setLinkError] = useState("");
  const [linkPreview, setLinkPreview] = useState(null);
  const [linkSaving, setLinkSaving] = useState(false);

  const todayDow = getSimDay();

  // ── Drag-to-reorder in day edit dialog ──────────────────────────────────
  const ROTINA_ITEM_H = 72;
  const dragExRef   = useRef({ active: false, idx: -1, startY: 0, hoverIdx: -1, count: 0 });
  const stateExRef  = useRef({});
  const [draggingExIdx,   setDraggingExIdx]   = useState(-1);
  const [dragExOffsetY,   setDragExOffsetY]   = useState(0);
  const [dropExTargetIdx, setDropExTargetIdx] = useState(-1);

  useEffect(() => {
    function onMove(e) {
      if (!dragExRef.current.active) return;
      e.preventDefault();
      const dy = e.clientY - dragExRef.current.startY;
      const newHover = Math.max(0, Math.min(dragExRef.current.count - 1,
        Math.round(dragExRef.current.idx + dy / ROTINA_ITEM_H)));
      dragExRef.current.hoverIdx = newHover;
      setDragExOffsetY(dy);
      setDropExTargetIdx(newHover);
    }
    function onUp() {
      if (!dragExRef.current.active) return;
      const { idx, hoverIdx } = dragExRef.current;
      dragExRef.current = { active: false, idx: -1, startY: 0, hoverIdx: -1, count: 0 };
      setDraggingExIdx(-1); setDragExOffsetY(0); setDropExTargetIdx(-1);
      if (hoverIdx !== idx && hoverIdx >= 0) {
        const { editExercises: list } = stateExRef.current;
        const newList = [...list];
        const [removed] = newList.splice(idx, 1);
        newList.splice(hoverIdx, 0, removed);
        setEditExercises(newList);
      }
    }
    document.addEventListener("pointermove", onMove, { passive: false });
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onUp);
    };
  }, []);

  function onDragExHandleDown(e, idx) {
    if (editDow === null) return;
    e.preventDefault();
    e.stopPropagation();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
    dragExRef.current = { active: true, idx, startY: e.clientY, hoverIdx: idx, count: stateExRef.current.editExercises?.length ?? 0 };
    setDraggingExIdx(idx);
    setDropExTargetIdx(idx);
    setDragExOffsetY(0);
  }

  // Auto-open day when navigated from Home with openDow state
  useEffect(() => {
    if (location.state?.openDow != null && !loading) {
      openEdit(location.state.openDow);
      // Clear state so it doesn't re-open on re-renders
      window.history.replaceState({}, "");
    }
  }, [loading, location.state]);

  useEffect(() => {
    // Cache já foi aplicado no useState — só precisa de refresh em background
    Promise.all([
      api.get("/routine"),
      api.get("/machines"),
      api.get("/routine/templates"),
    ]).then(([rRes, mRes, tRes]) => {
      const tpls = Array.isArray(tRes.data) ? tRes.data : [];
      setRoutine(rRes.data);
      setMachines(mRes.data);
      setTemplates(tpls);
      cacheAllRoutine(rRes.data);
      cacheMachines(mRes.data);
      cacheTemplates(tpls);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // ── Template persistence ──
  function persistTemplates(tpls) {
    setTemplates(tpls);
    cacheTemplates(tpls);
    api.put("/routine/templates", { templates: tpls }).catch(() => {});
  }

  // ── Day template CRUD ──
  function openNewDayTpl() {
    setEditTplId(null); setEditTplName(""); setEditTplExercises([]);
    setEditTplOpen(true);
  }
  function openEditDayTpl(tpl) {
    setEditTplId(tpl.id); setEditTplName(tpl.name);
    setEditTplExercises(enrichTplExercises(tpl.exercises, machines));
    setEditTplOpen(true);
  }
  function saveDayTpl() {
    const id = editTplId ?? String(Date.now());
    const tpl = {
      id, type: "day", name: editTplName.trim() || "Modelo",
      exercises: editTplExercises.map((e) => ({
        machineId: e.machineId,
        machine: { id: e.machine.id, name: e.machine.name, category: e.machine.category, photoBase64: e.machine.photoBase64 ?? null },
        sets: e.sets, reps: e.reps, repsMax: e.repsMax ?? null,
      })),
    };
    persistTemplates(editTplId ? templates.map((t) => t.id === editTplId ? tpl : t) : [...templates, tpl]);
    setEditTplOpen(false);
  }

  function deleteTpl(id) { persistTemplates(templates.filter((t) => t.id !== id)); }

  // ── Apply day template to a day ──
  async function applyTemplateToDay() {
    if (applyTplDow === null || !applyTpl) return;
    setApplyTplSaving(true);
    try {
      const r = await api.put(`/routine/day/${applyTplDow}`, {
        label: applyTpl.name,
        exercises: applyTpl.exercises.map((e) => ({ machineId: e.machineId, sets: e.sets, reps: e.reps, repsMax: e.repsMax ?? null })),
      });
      setRoutine((prev) => {
        const without = prev.filter((d) => d.dayOfWeek !== applyTplDow);
        if (r.data?.id) return [...without, r.data].sort((a, b) => a.dayOfWeek - b.dayOfWeek);
        return without;
      });
      setApplyTpl(null); setApplyTplDow(null);
    } finally { setApplyTplSaving(false); }
  }

  // Save current day as template
  function saveDayAsTemplate() {
    const id = String(Date.now());
    const name = editLabel.trim() || DAYS[editDow] || "Modelo";
    const tpl = {
      id, type: "day", name,
      exercises: editExercises.map((e) => ({
        machineId: e.machineId,
        machine: { id: e.machine.id, name: e.machine.name, category: e.machine.category, photoBase64: e.machine.photoBase64 ?? null },
        sets: e.sets, reps: e.reps, repsMax: e.repsMax ?? null,
      })),
    };
    persistTemplates([...templates, tpl]);
    setTplSavedFeedback(true);
    setTimeout(() => setTplSavedFeedback(false), 2000);
  }


  // ── Day edit helpers ──
  function openEdit(dow) {
    const existing = routine.find((d) => d.dayOfWeek === dow);
    setEditDow(dow); setEditLabel(existing?.label || "");
    setBulkRepsOpen(false); setBulkRepsValue("");
    setEditExercises(
      existing?.exercises?.map((e) => ({
        machineId: e.machine.id,
        machine: machines.find((m) => m.id === e.machine.id) || e.machine,
        sets: e.sets, reps: e.reps, repsMax: e.repsMax ?? null,
      })) || []
    );
  }

  function applyBulkReps() {
    const p = parseReps(bulkRepsValue);
    setEditExercises((prev) => prev.map((e) => ({ ...e, reps: p.reps, repsMax: p.repsMax })));
    setBulkRepsOpen(false); setBulkRepsValue("");
  }

  async function applyGlobalBulk() {
    const p = globalBulkReps.trim() ? parseReps(globalBulkReps) : null;
    const newSets = globalBulkSets.trim() ? parseInt(globalBulkSets) : null;
    if (!p && !newSets) return;
    setGlobalBulkSaving(true);
    try {
      const updated = [];
      for (const day of routine.filter((d) => d.exercises?.length > 0)) {
        const r = await api.put(`/routine/day/${day.dayOfWeek}`, {
          label: day.label ?? null,
          exercises: day.exercises.map((e) => ({
            machineId: e.machine.id,
            sets: newSets ?? e.sets,
            reps: p ? p.reps : e.reps,
            repsMax: p ? p.repsMax : (e.repsMax ?? null),
          })),
        });
        if (r.data?.id) updated.push(r.data);
      }
      setRoutine((prev) => {
        const dows = updated.map((d) => d.dayOfWeek);
        return [...prev.filter((d) => !dows.includes(d.dayOfWeek)), ...updated].sort((a, b) => a.dayOfWeek - b.dayOfWeek);
      });
      setGlobalBulkOpen(false); setGlobalBulkReps(""); setGlobalBulkSets("");
    } finally { setGlobalBulkSaving(false); }
  }

  // ── Machine picker ──
  function selectMachine(m) {
    setPickedMachine(m);
    setAddPR(m.currentPR != null ? String(m.currentPR) : "");
    setPickOpen(false); setSetsOpen(true);
  }

  async function confirmAdd() {
    const p = parseReps(addReps);
    const newPR = addPR.trim() !== "" ? parseFloat(addPR) : undefined;
    const updatedMachine = newPR !== undefined ? { ...pickedMachine, currentPR: newPR } : pickedMachine;
    const newEx = { machineId: pickedMachine.id, machine: updatedMachine, sets: parseInt(addSets) || 3, reps: p.reps, repsMax: p.repsMax };
    if (pickCtx === "tpl") setEditTplExercises((prev) => [...prev, newEx]);
    else setEditExercises((prev) => [...prev, newEx]);
    if (pickCtx === "day" && newPR !== undefined && newPR !== pickedMachine.currentPR) {
      await api.patch(`/machines/${pickedMachine.id}`, { currentPR: newPR }).catch(() => {});
      setMachines((prev) => prev.map((m) => m.id === pickedMachine.id ? { ...m, currentPR: newPR } : m));
    }
    setSetsOpen(false); setPickedMachine(null); setAddSets("3"); setAddReps("12"); setAddPR("");
  }

  // ── Exercise edit ──
  function openEditEx(idx, ctx = "day") {
    const list = ctx === "tpl" ? editTplExercises : editExercises;
    const ex = list[idx];
    setEditExSets(String(ex.sets));
    setEditExReps(formatReps(ex.reps, ex.repsMax));
    setEditExPR(ctx === "day" && ex.machine.currentPR != null ? String(ex.machine.currentPR) : "");
    setEditExCtx(ctx);
    setEditExIdx(idx);
  }

  async function confirmEditEx() {
    const idx = editExIdx;
    const p = parseReps(editExReps);
    if (editExCtx === "tpl") {
      const setter = editTplOpen ? setEditTplExercises : setEditExercises;
      setter((prev) => prev.map((e, i) => i === idx ? { ...e, sets: parseInt(editExSets) || e.sets, reps: p.reps, repsMax: p.repsMax } : e));
      setEditExIdx(null);
      return;
    }
    const ex = editExercises[idx];
    const newPR = editExPR !== "" ? parseFloat(editExPR) : null;
    const oldPR = ex.machine.currentPR ?? null;
    const newList = editExercises.map((e, i) =>
      i === idx ? { ...e, sets: parseInt(editExSets) || e.sets, reps: p.reps, repsMax: p.repsMax, machine: { ...e.machine, currentPR: newPR } } : e
    );
    setEditExercises(newList);
    setEditExIdx(null);
    setSaving(true);
    try {
      const r = await api.put(`/routine/day/${editDow}`, {
        label: editLabel.trim() || null,
        exercises: newList.map((e) => ({ machineId: e.machineId, sets: e.sets, reps: e.reps, repsMax: e.repsMax ?? null })),
      });
      setRoutine((prev) => {
        const without = prev.filter((d) => d.dayOfWeek !== editDow);
        if (r.data?.id) return [...without, r.data].sort((a, b) => a.dayOfWeek - b.dayOfWeek);
        return without;
      });
      if (String(newPR) !== String(oldPR)) {
        await api.patch(`/machines/${ex.machineId}`, { currentPR: newPR });
        setMachines((prev) => prev.map((m) => m.id === ex.machineId ? { ...m, currentPR: newPR } : m));
      }
      if (editDow === todayDow) {
        localStorage.removeItem(`dg_today_ex_${new Date().toISOString().split("T")[0]}`);
      }
    } finally { setSaving(false); }
  }

  async function saveDay() {
    setSaving(true);
    const r = await api.put(`/routine/day/${editDow}`, {
      label: editLabel.trim() || null,
      exercises: editExercises.map((e) => ({ machineId: e.machineId, sets: e.sets, reps: e.reps, repsMax: e.repsMax ?? null })),
    });
    setRoutine((prev) => {
      const without = prev.filter((d) => d.dayOfWeek !== editDow);
      if (r.data?.id) return [...without, r.data].sort((a, b) => a.dayOfWeek - b.dayOfWeek);
      return without;
    });
    // Se salvou o dia de hoje, limpa o override do treino para pegar a rotina nova
    if (editDow === todayDow) {
      localStorage.removeItem(`dg_today_ex_${new Date().toISOString().split("T")[0]}`);
    }
    setSaving(false); setEditDow(null);
  }

  async function fetchFriendRoutine() {
    if (!linkEmail.trim()) return;
    setLinkLoading(true);
    setLinkError("");
    setLinkPreview(null);
    try {
      const { data } = await api.get(`/routine/by-email?email=${encodeURIComponent(linkEmail.trim())}`);
      setLinkPreview(data);
    } catch (err) {
      setLinkError(err.response?.data?.error || "Usuário não encontrado.");
    } finally {
      setLinkLoading(false);
    }
  }

  async function applyFriendRoutine() {
    if (!linkPreview) return;
    setLinkSaving(true);
    setLinkError("");
    try {
      const machineMap = {};
      for (const m of machines) machineMap[m.name] = m.id;
      const updatedMachines = [...machines];
      const updatedRoutineDays = [];

      for (const day of linkPreview.days) {
        const exercises = [];
        for (const ex of day.exercises) {
          let machineId = machineMap[ex.name];
          if (!machineId) {
            const { data: newM } = await api.post("/machines", { name: ex.name, category: ex.category });
            machineMap[ex.name] = newM.id;
            machineId = newM.id;
            updatedMachines.push(newM);
          }
          exercises.push({ machineId, sets: ex.sets, reps: ex.reps, repsMax: ex.repsMax });
        }
        const { data: savedDay } = await api.put(`/routine/day/${day.dayOfWeek}`, {
          label: day.label,
          exercises,
        });
        if (savedDay?.id) updatedRoutineDays.push(savedDay);
      }

      setMachines(updatedMachines);
      setRoutine((prev) => {
        const importedDows = updatedRoutineDays.map((d) => d.dayOfWeek);
        return [...prev.filter((d) => !importedDows.includes(d.dayOfWeek)), ...updatedRoutineDays].sort((a, b) => a.dayOfWeek - b.dayOfWeek);
      });
      setLinkOpen(false);
      setLinkEmail("");
      setLinkPreview(null);
    } catch {
      setLinkError("Erro ao importar rotina. Tente novamente.");
    } finally {
      setLinkSaving(false);
    }
  }

  const bg = PAGE_BG;
  stateExRef.current = { editExercises };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh" sx={{ background: bg }}>
        <CircularProgress color="primary" />
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: "100vh", pb: 10, background: bg }}>
      <Container maxWidth="sm" sx={{ px: 2 }}>

        {/* ── Header ── */}
        <Box sx={{ pt: 1.5, pb: 2 }}>
          <Stack direction="row" alignItems="flex-end" justifyContent="space-between">
            <Box>
              <Typography variant="h6" fontWeight={900}>Rotina semanal</Typography>
              <Typography variant="body2" color="text.secondary">Toque no dia para editar</Typography>
            </Box>
            <Stack direction="row" spacing={0.5}>
              <IconButton
                onClick={() => { setLinkEmail(""); setLinkPreview(null); setLinkError(""); setLinkOpen(true); }}
                size="small"
                sx={{ color: "rgba(255,255,255,0.35)", "&:hover": { color: "rgba(255,255,255,0.7)" } }}
                title="Vincular rotina de um amigo">
                <PersonAddIcon fontSize="small" />
              </IconButton>
              <IconButton
                onClick={() => { setGlobalBulkReps(""); setGlobalBulkSets(""); setGlobalBulkOpen(true); }}
                size="small"
                sx={{ color: "rgba(255,255,255,0.35)", "&:hover": { color: "rgba(255,255,255,0.7)" } }}
                title="Editar séries e reps de toda a rotina">
                <EditIcon fontSize="small" />
              </IconButton>
            </Stack>
          </Stack>
        </Box>

        {/* ── Empty state ── */}
        {routine.length === 0 ? (
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", textAlign: "center", py: 8 }}>
            <FitnessCenterIcon sx={{ fontSize: 54, color: "#22c55e", mb: 2, opacity: 0.7 }} />
            <Typography fontWeight={900} fontSize="1.3rem" mb={0.5}>Vamos montar seu treino?</Typography>
            <Typography color="text.secondary" fontSize="0.88rem" mb={3} maxWidth={240}>
              Configure sua rotina semanal do zero.
            </Typography>
            <Button variant="contained" onClick={() => openEdit(todayDow)}
              sx={{ py: 1.4, fontWeight: 800, fontSize: "0.95rem", px: 5 }}>
              Começar
            </Button>
          </Box>
        ) : (

        /* ── Days list ── */
        <Stack spacing={1.5}>
          {DAYS.map((label, dow) => {
            const day = routine.find((d) => d.dayOfWeek === dow);
            const exercises = day?.exercises || [];
            const isToday = dow === todayDow;
            return (
              <Box key={dow} sx={{
                borderRadius: 1.5, overflow: "hidden",
                border: isToday ? "1px solid rgba(34,197,94,0.3)" : "1px solid rgba(255,255,255,0.07)",
                background: isToday ? "linear-gradient(135deg, rgba(34,197,94,0.08), rgba(34,197,94,0.02))" : "rgba(255,255,255,0.04)",
              }}>
                <Box onClick={() => openEdit(dow)} sx={{
                  px: 2, pt: 1.5, pb: exercises.length > 0 ? 1 : 1.5,
                  display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer",
                }}>
                  <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
                    <Typography fontWeight={800} fontSize="0.97rem"
                      color={exercises.length > 0 ? (isToday ? "#22c55e" : "text.primary") : "text.secondary"}>
                      {label}
                    </Typography>
                    {isToday && <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: "#22c55e", flexShrink: 0 }} />}
                    {day?.label && (
                      <Box sx={{ px: 0.9, py: 0.15, borderRadius: 1,
                        bgcolor: isToday ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.07)",
                        border: isToday ? "1px solid rgba(34,197,94,0.25)" : "1px solid rgba(255,255,255,0.1)" }}>
                        <Typography fontSize="0.68rem" fontWeight={800} color={isToday ? "#22c55e" : "rgba(255,255,255,0.5)"}>
                          {day.label}
                        </Typography>
                      </Box>
                    )}
                    {exercises.length > 0 && (
                      <Typography variant="caption" color="text.secondary">
                        {exercises.length} exercício{exercises.length > 1 ? "s" : ""}
                      </Typography>
                    )}
                  </Stack>
                  <ChevronRightIcon sx={{ color: "rgba(255,255,255,0.2)", fontSize: 18 }} />
                </Box>
                {exercises.length > 0 ? (
                  <Stack>
                    {exercises.map((ex, i) => {
                      const machine = machines.find((m) => m.id === ex.machine.id) || ex.machine;
                      return (
                        <Box key={ex.id}>
                          {i > 0 && <Box sx={{ height: "1px", bgcolor: "rgba(255,255,255,0.05)", mx: 2 }} />}
                          <Box onClick={() => openEdit(dow)} sx={{
                            px: 2, py: 1.2, display: "flex", alignItems: "center", gap: 1.5,
                            cursor: "pointer", "&:active": { opacity: 0.7 },
                          }}>
                            <ExerciseThumbnail machine={machine} size={52} />
                            <Box sx={{ flex: 1 }}>
                              <Typography fontWeight={600} fontSize="0.88rem">{machine.name}</Typography>
                              <Typography variant="caption" color="text.secondary">
                                {ex.sets} séries × {formatReps(ex.reps, ex.repsMax)} reps
                              </Typography>
                            </Box>
                            <ChevronRightIcon sx={{ color: "rgba(255,255,255,0.15)", fontSize: 16 }} />
                          </Box>
                        </Box>
                      );
                    })}
                  </Stack>
                ) : (
                  <Box sx={{ px: 2, pb: 1.5 }}>
                    <Typography variant="body2" color="text.secondary" fontSize="0.82rem">Descanso</Typography>
                  </Box>
                )}
              </Box>
            );
          })}
        </Stack>
        )} {/* end routine.length === 0 ? ... : ... */}
      </Container>

      {/* ── FAB: Modelos (hidden when empty state) ── */}
      {routine.length > 0 && (
      <Box sx={{ position: "fixed", bottom: 110, right: 20, zIndex: 1300 }}>
        <Box
          onClick={() => setTplPanelOpen(true)}
          sx={{
            width: 52, height: 52, borderRadius: "50%", bgcolor: "#22c55e",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer",
            boxShadow: "0 4px 20px rgba(34,197,94,0.38), 0 2px 10px rgba(0,0,0,0.5)",
            transition: "transform 0.14s",
            "&:active": { transform: "scale(0.88)" },
          }}
        >
          <BookmarkIcon sx={{ color: "#000", fontSize: 22 }} />
        </Box>
      </Box>
      )}

      {/* ════════════ DIALOGS ════════════ */}

      {/* Global bulk reps + sets */}
      <Dialog open={globalBulkOpen} onClose={() => setGlobalBulkOpen(false)} fullWidth maxWidth="xs"
        PaperProps={{ sx: { bgcolor: "#071a12", backgroundImage: "none", borderRadius: 2 } }}>
        <DialogTitle sx={{ fontWeight: 900, pb: 0.5 }}>Editar toda a rotina</DialogTitle>
        <DialogContent sx={{ pt: 1.5 }}>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Deixe em branco o que não quiser alterar. Aplica a todos os exercícios de todos os dias.
          </Typography>
          <Stack spacing={1.5}>
            <TextField label="Séries (ex: 3 ou 4)" value={globalBulkSets}
              onChange={(e) => setGlobalBulkSets(e.target.value)} size="small" fullWidth autoFocus
              placeholder="ex: 3" type="number" inputProps={{ min: 1 }} />
            <TextField label="Reps (ex: 12 ou 6-9)" value={globalBulkReps}
              onChange={(e) => setGlobalBulkReps(e.target.value)} size="small" fullWidth
              placeholder="ex: 12 ou 6-9" />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setGlobalBulkOpen(false)} sx={{ color: "rgba(255,255,255,0.5)" }}>Cancelar</Button>
          <Button variant="contained" onClick={applyGlobalBulk}
            disabled={(!globalBulkReps.trim() && !globalBulkSets.trim()) || globalBulkSaving}>
            {globalBulkSaving ? <CircularProgress size={18} /> : "Aplicar"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Day edit */}
      <Dialog open={editDow !== null} onClose={() => setEditDow(null)}
        fullWidth maxWidth="sm" disableRestoreFocus
        PaperProps={{ sx: { bgcolor: "#071a12", backgroundImage: "none", borderRadius: 2 } }}>
        <DialogTitle sx={{ fontWeight: 900, pb: 0.5 }}>
          {editDow !== null ? DAYS[editDow] : ""}
        </DialogTitle>
        <DialogContent sx={{ px: 2, pt: 1.5, pb: 1, overflow: "visible" }}>
          <Stack direction="row" spacing={1} mb={1.5}>
            <TextField
              label="Título do treino (ex: Pull, Push, Leg...)"
              value={editLabel} onChange={(e) => setEditLabel(e.target.value)}
              size="small" fullWidth inputProps={{ maxLength: 30 }} />
          </Stack>
          <Box sx={{ overflowY: "auto", maxHeight: "52vh" }}>
            {editExercises.length === 0 && (
              <Typography variant="body2" color="text.secondary" my={2} textAlign="center">
                Nenhum exercício ainda.
              </Typography>
            )}
            {editExercises.length > 1 && (
              <Box sx={{ mb: 1.5 }}>
                {!bulkRepsOpen ? (
                  <Button size="small" variant="text" onClick={() => { setBulkRepsOpen(true); setBulkRepsValue(""); }}
                    sx={{ color: "rgba(255,255,255,0.35)", fontSize: "0.75rem", textTransform: "none", p: 0, minWidth: 0 }}>
                    Editar todas as reps deste dia
                  </Button>
                ) : (
                  <Collapse in={bulkRepsOpen}>
                    <Stack direction="row" spacing={1} alignItems="center"
                      sx={{ p: 1.2, borderRadius: 2, bgcolor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                      <TextField size="small" label="Reps (ex: 12 ou 6-9)" value={bulkRepsValue}
                        onChange={(e) => setBulkRepsValue(e.target.value)} autoFocus sx={{ flex: 1 }}
                        onKeyDown={(e) => { if (e.key === "Enter" && bulkRepsValue) applyBulkReps(); if (e.key === "Escape") setBulkRepsOpen(false); }} />
                      <Button size="small" variant="contained" onClick={applyBulkReps}
                        disabled={!bulkRepsValue.trim()} sx={{ fontWeight: 700, whiteSpace: "nowrap" }}>Aplicar</Button>
                      <Button size="small" onClick={() => setBulkRepsOpen(false)}
                        sx={{ color: "rgba(255,255,255,0.4)", minWidth: 0, px: 0.5 }}>✕</Button>
                    </Stack>
                  </Collapse>
                )}
              </Box>
            )}
            <Stack spacing={0.8} mb={1.5}>
              {editExercises.map((ex, idx) => {
                const isDragging = draggingExIdx === idx;
                const dragShift = (() => {
                  if (draggingExIdx < 0 || isDragging) return 0;
                  if (draggingExIdx < dropExTargetIdx && idx > draggingExIdx && idx <= dropExTargetIdx) return -ROTINA_ITEM_H;
                  if (draggingExIdx > dropExTargetIdx && idx >= dropExTargetIdx && idx < draggingExIdx) return ROTINA_ITEM_H;
                  return 0;
                })();
                return (
                  <Box key={idx} sx={{
                    display: "flex", alignItems: "center", gap: 1, p: 1.2, borderRadius: 2.5,
                    bgcolor: isDragging ? "rgba(34,197,94,0.08)" : "rgba(255,255,255,0.04)",
                    border: isDragging ? "1px solid rgba(34,197,94,0.2)" : "1px solid rgba(255,255,255,0.06)",
                    transform: isDragging ? `translateY(${dragExOffsetY}px) scale(1.02)` : dragShift !== 0 ? `translateY(${dragShift}px)` : "none",
                    transition: isDragging ? "none" : "transform 0.1s cubic-bezier(0.2,0,0,1)",
                    willChange: isDragging ? "transform" : "auto",
                    zIndex: isDragging ? 10 : 1,
                    boxShadow: isDragging ? "0 8px 24px rgba(0,0,0,0.5)" : "none",
                    position: "relative",
                  }}>
                    <Box onPointerDown={(e) => onDragExHandleDown(e, idx)}
                      sx={{ flexShrink: 0, color: "rgba(255,255,255,0.28)", cursor: "grab",
                        touchAction: "none", display: "flex", alignItems: "center" }}>
                      <DragIndicatorIcon sx={{ fontSize: 20 }} />
                    </Box>
                    <ExerciseThumbnail machine={ex.machine} size={48} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography fontWeight={600} fontSize="0.87rem" noWrap>{ex.machine.name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {ex.sets}×{formatReps(ex.reps, ex.repsMax)}
                        {ex.machine.currentPR != null ? ` · PR: ${ex.machine.currentPR}kg` : ""}
                      </Typography>
                    </Box>
                    <IconButton onClick={() => openEditEx(idx, "day")} sx={{ color: "rgba(255,255,255,0.55)", p: 1 }}>
                      <EditIcon sx={{ fontSize: 22 }} />
                    </IconButton>
                    <IconButton onClick={() => setEditExercises((p) => p.filter((_, i) => i !== idx))}
                      sx={{ color: "#ef4444", p: 1 }}>
                      <DeleteIcon sx={{ fontSize: 22 }} />
                    </IconButton>
                  </Box>
                );
              })}
            </Stack>
            <Button startIcon={<AddIcon />} fullWidth variant="outlined" size="small"
              onClick={() => { setPickCtx("day"); setPickOpen(true); }}
              sx={{ borderColor: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.6)", borderRadius: 2, py: 1 }}>
              Adicionar exercício
            </Button>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 2.5, pb: 2.5, gap: 0.5 }}>
          {editExercises.length > 0 && (
            <Button size="small" startIcon={tplSavedFeedback ? null : <BookmarkAddIcon sx={{ fontSize: 18 }} />}
              onClick={saveDayAsTemplate}
              sx={{ mr: "auto", fontWeight: 700, fontSize: "0.75rem", textTransform: "none",
                color: tplSavedFeedback ? "#22c55e" : "rgba(255,255,255,0.4)",
                "&:hover": { color: "rgba(255,255,255,0.7)" } }}>
              {tplSavedFeedback ? "Salvo!" : "Salvar como modelo"}
            </Button>
          )}
          <Button onClick={() => setEditDow(null)} sx={{ color: "rgba(255,255,255,0.5)" }}>Cancelar</Button>
          <Button variant="contained" onClick={saveDay} disabled={saving}>
            {saving ? <CircularProgress size={18} /> : "Salvar"}
          </Button>
        </DialogActions>
      </Dialog>


      {/* Machine picker */}
      <Dialog open={pickOpen} onClose={() => setPickOpen(false)} fullWidth maxWidth="sm" disableRestoreFocus
        PaperProps={{ sx: { bgcolor: "#071a12", backgroundImage: "none", borderRadius: 2 } }}>
        <DialogTitle sx={{ fontWeight: 900, pb: 1, display: "flex", alignItems: "center", gap: 1 }}>
          <IconButton size="small" onClick={() => setPickOpen(false)}
            sx={{ color: "rgba(255,255,255,0.5)", mr: 0.5, "&:hover": { color: "#fff" } }}>
            <ArrowBackIcon fontSize="small" />
          </IconButton>
          Escolher exercício
        </DialogTitle>
        <DialogContent sx={{ px: 2, pt: 0, pb: 2 }}>
          <Stack spacing={0.7}>
            {machines.map((m) => (
              <Box key={m.id} onClick={() => selectMachine(m)} sx={{
                display: "flex", alignItems: "center", gap: 1.5, p: 1.1, borderRadius: 2.5, cursor: "pointer",
                bgcolor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)",
                "&:active": { opacity: 0.7 }, "&:hover": { bgcolor: "rgba(255,255,255,0.07)" },
              }}>
                <ExerciseThumbnail machine={m} size={46} />
                <Box sx={{ flex: 1 }}>
                  <Typography fontWeight={600} fontSize="0.87rem">{m.name}</Typography>
                  <Typography variant="caption" color="text.secondary">{m.category}</Typography>
                </Box>
                <ChevronRightIcon sx={{ color: "rgba(255,255,255,0.2)", fontSize: 16 }} />
              </Box>
            ))}
          </Stack>
        </DialogContent>
      </Dialog>

      {/* Sets/reps picker */}
      <Dialog open={setsOpen} onClose={() => setSetsOpen(false)} fullWidth maxWidth="xs" disableRestoreFocus
        PaperProps={{ sx: { bgcolor: "#071a12", backgroundImage: "none", borderRadius: 2 } }}>
        <DialogTitle sx={{ fontWeight: 900, pb: 1 }}>
          {pickedMachine && (
            <Stack direction="row" alignItems="center" gap={1.5}>
              <ExerciseThumbnail machine={pickedMachine} size={42} />
              <Box>
                <Typography fontWeight={800} fontSize="0.95rem" lineHeight={1.2}>{pickedMachine.name}</Typography>
                <Typography variant="caption" color="text.secondary">{pickedMachine.category}</Typography>
              </Box>
            </Stack>
          )}
        </DialogTitle>
        <DialogContent>
          <Stack direction="row" spacing={2} mt={0.5} mb={pickCtx === "day" ? 1.5 : 0}>
            <TextField label="Séries" type="number" value={addSets}
              onChange={(e) => setAddSets(e.target.value)} size="small" fullWidth inputProps={{ min: 1 }} />
            <TextField label="Reps" type="text" value={addReps}
              onChange={(e) => setAddReps(e.target.value)} size="small" fullWidth placeholder="12 ou 6-9" />
          </Stack>
          {pickCtx === "day" && (
            <TextField label="PR atual (kg)" type="number" value={addPR}
              onChange={(e) => setAddPR(e.target.value)} size="small" fullWidth
              placeholder="ex: 70" inputProps={{ min: 0, step: 2.5 }} />
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setSetsOpen(false)} sx={{ color: "rgba(255,255,255,0.5)" }}>Cancelar</Button>
          <Button variant="contained" onClick={confirmAdd}>Adicionar</Button>
        </DialogActions>
      </Dialog>

      {/* Exercise edit */}
      <Dialog open={editExIdx !== null} onClose={() => setEditExIdx(null)} fullWidth maxWidth="xs" disableRestoreFocus
        PaperProps={{ sx: { bgcolor: "#071a12", backgroundImage: "none", borderRadius: 2 } }}>
        {editExIdx !== null && (() => {
          const list = editExCtx === "tpl" && editTplOpen ? editTplExercises : editExercises;
          const ex = list[editExIdx];
          if (!ex) return null;
          return (
            <>
              <DialogTitle sx={{ fontWeight: 900, pb: 1 }}>
                <Stack direction="row" alignItems="center" gap={1.5}>
                  <ExerciseThumbnail machine={ex.machine} size={42} />
                  <Box>
                    <Typography fontWeight={800} fontSize="0.95rem" lineHeight={1.2}>{ex.machine.name}</Typography>
                    <Typography variant="caption" color="text.secondary">{ex.machine.category}</Typography>
                  </Box>
                </Stack>
              </DialogTitle>
              <DialogContent>
                <Stack direction="row" spacing={2} mt={0.5} mb={editExCtx === "day" ? 1.5 : 0}>
                  <TextField label="Séries" type="number" value={editExSets}
                    onChange={(e) => setEditExSets(e.target.value)} size="small" fullWidth inputProps={{ min: 1 }} />
                  <TextField label="Reps" type="text" value={editExReps}
                    onChange={(e) => setEditExReps(e.target.value)} size="small" fullWidth placeholder="12 ou 6-9" />
                </Stack>
                {editExCtx === "day" && (
                  <TextField label="PR atual (kg)" type="number" value={editExPR}
                    onChange={(e) => setEditExPR(e.target.value)} size="small" fullWidth
                    placeholder="ex: 70" inputProps={{ min: 0, step: 2.5 }} />
                )}
              </DialogContent>
              <DialogActions sx={{ px: 3, pb: 2.5 }}>
                <Button onClick={() => setEditExIdx(null)} sx={{ color: "rgba(255,255,255,0.5)" }}>Cancelar</Button>
                <Button variant="contained" onClick={confirmEditEx} disabled={saving}>
                  {saving ? <CircularProgress size={18} /> : "Salvar"}
                </Button>
              </DialogActions>
            </>
          );
        })()}
      </Dialog>

      {/* Apply day template → day picker */}
      <Dialog open={!!applyTpl} onClose={() => { setApplyTpl(null); setApplyTplDow(null); }} fullWidth maxWidth="xs"
        PaperProps={{ sx: { bgcolor: "#071a12", backgroundImage: "none", borderRadius: 2 } }}>
        {applyTpl && (
          <>
            <DialogTitle sx={{ fontWeight: 900, pb: 0.5 }}>Aplicar modelo</DialogTitle>
            <DialogContent sx={{ px: 2.5, pt: 1 }}>
              <Box sx={{ mb: 2 }}>
                <Typography fontWeight={800} color="#22c55e">{applyTpl.name}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {applyTpl.exercises.length} exercício{applyTpl.exercises.length !== 1 ? "s" : ""}
                </Typography>
              </Box>
              <Typography variant="caption" color="text.secondary" fontWeight={700} letterSpacing={0.5} display="block" mb={1.2}>
                ESCOLHA O DIA
              </Typography>
              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 1 }}>
                {DAYS.map((label, dow) => {
                  const hasRoutine = routine.some((d) => d.dayOfWeek === dow && d.exercises?.length > 0);
                  const sel = applyTplDow === dow;
                  const isToday = dow === todayDow;
                  return (
                    <Box key={dow} onClick={() => setApplyTplDow(dow)} sx={{
                      py: 1.4, borderRadius: 2.5, textAlign: "center", cursor: "pointer",
                      border: sel ? "2px solid #22c55e" : isToday ? "1px solid rgba(34,197,94,0.3)" : "1px solid rgba(255,255,255,0.1)",
                      bgcolor: sel ? "rgba(34,197,94,0.18)" : isToday ? "rgba(34,197,94,0.06)" : "rgba(255,255,255,0.04)",
                      transition: "all 0.12s", "&:active": { transform: "scale(0.95)" },
                    }}>
                      <Typography fontWeight={800} fontSize="0.82rem"
                        color={sel ? "#22c55e" : isToday ? "rgba(34,197,94,0.8)" : "rgba(255,255,255,0.8)"}>
                        {label.slice(0, 3)}
                      </Typography>
                      {hasRoutine && (
                        <Box sx={{ width: 4, height: 4, borderRadius: "50%", mx: "auto", mt: 0.5,
                          bgcolor: sel ? "#22c55e" : "rgba(255,255,255,0.3)" }} />
                      )}
                    </Box>
                  );
                })}
              </Box>
              {applyTplDow !== null && (
                <Box sx={{ mt: 1.8, p: 1.2, borderRadius: 2, bgcolor: "rgba(34,197,94,0.07)", border: "1px solid rgba(34,197,94,0.15)" }}>
                  <Typography variant="caption" color="rgba(34,197,94,0.85)" fontSize="0.8rem">
                    Os exercícios de <strong>{DAYS[applyTplDow]}</strong> serão substituídos pelo modelo <strong>{applyTpl.name}</strong>.
                  </Typography>
                </Box>
              )}
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2.5 }}>
              <Button onClick={() => { setApplyTpl(null); setApplyTplDow(null); }} sx={{ color: "rgba(255,255,255,0.5)" }}>Cancelar</Button>
              <Button variant="contained" onClick={applyTemplateToDay} disabled={applyTplDow === null || applyTplSaving}>
                {applyTplSaving ? <CircularProgress size={18} /> : "Aplicar"}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Day template create/edit */}
      <Dialog open={editTplOpen} onClose={() => setEditTplOpen(false)} fullWidth maxWidth="sm" disableRestoreFocus
        PaperProps={{ sx: { bgcolor: "#071a12", backgroundImage: "none", borderRadius: 2 } }}>
        <DialogTitle sx={{ fontWeight: 900, pb: 0.5 }}>{editTplId ? "Editar modelo" : "Novo modelo"}</DialogTitle>
        <DialogContent sx={{ px: 2, pt: 2.5, pb: 1, overflow: "visible" }}>
          <TextField label="Nome do modelo (ex: Pull A, Superiores...)" value={editTplName}
            onChange={(e) => setEditTplName(e.target.value)} size="small" fullWidth sx={{ mb: 2 }}
            inputProps={{ maxLength: 40 }} autoFocus />
          <Box sx={{ overflowY: "auto", maxHeight: "50vh" }}>
            {editTplExercises.length === 0 && (
              <Typography variant="body2" color="text.secondary" my={2} textAlign="center">Nenhum exercício ainda.</Typography>
            )}
            <Stack spacing={0.8} mb={1.5}>
              {editTplExercises.map((ex, idx) => (
                <Box key={idx} sx={{ display: "flex", alignItems: "center", gap: 1, p: 1.2, borderRadius: 2.5,
                  bgcolor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <ExerciseThumbnail machine={ex.machine} size={48} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography fontWeight={600} fontSize="0.87rem" noWrap>{ex.machine.name}</Typography>
                    <Typography variant="caption" color="text.secondary">{ex.sets}×{formatReps(ex.reps, ex.repsMax)}</Typography>
                  </Box>
                  <IconButton onClick={() => openEditEx(idx, "tpl")} sx={{ color: "rgba(255,255,255,0.55)", p: 1 }}>
                    <EditIcon sx={{ fontSize: 22 }} />
                  </IconButton>
                  <IconButton onClick={() => setEditTplExercises((p) => p.filter((_, i) => i !== idx))}
                    sx={{ color: "#ef4444", p: 1 }}>
                    <DeleteIcon sx={{ fontSize: 22 }} />
                  </IconButton>
                </Box>
              ))}
            </Stack>
            <Button startIcon={<AddIcon />} fullWidth variant="outlined" size="small"
              onClick={() => { setPickCtx("tpl"); setPickOpen(true); }}
              sx={{ borderColor: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.6)", borderRadius: 2, py: 1 }}>
              Adicionar exercício
            </Button>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, justifyContent: "center", gap: 1.5 }}>
          <Button onClick={() => setEditTplOpen(false)} sx={{ color: "rgba(255,255,255,0.5)" }}>Cancelar</Button>
          <Button variant="contained" onClick={saveDayTpl} disabled={!editTplName.trim() && editTplExercises.length === 0}>
            Salvar modelo
          </Button>
        </DialogActions>
      </Dialog>

      {/* ════════ Templates panel ════════ */}
      <Dialog
        open={tplPanelOpen}
        onClose={() => setTplPanelOpen(false)}
        fullWidth maxWidth="md"
        PaperProps={{
          sx: {
            borderRadius: 1.5,
            maxHeight: "82vh",
            bgcolor: "#071a12",
            backgroundImage: "none",
          },
        }}
      >
        {/* Header */}
        <Box sx={{ px: 3, pt: 2, pb: 1.5, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Box>
            <Typography fontWeight={900} fontSize="1.1rem">Modelos de treino</Typography>
            <Typography variant="caption" color="text.secondary">
              {templates.length === 0 ? "Nenhum modelo salvo" : `${templates.length} modelo${templates.length !== 1 ? "s" : ""}`}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <IconButton
              onClick={openNewDayTpl}
              sx={{
                bgcolor: "rgba(34,197,94,0.12)", color: "#22c55e", borderRadius: 2,
                border: "1px solid rgba(34,197,94,0.25)",
                "&:hover": { bgcolor: "rgba(34,197,94,0.2)" },
              }}>
              <AddIcon />
            </IconButton>
            <IconButton size="small" onClick={() => setTplPanelOpen(false)}
              sx={{ color: "rgba(255,255,255,0.4)" }}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Stack>
        </Box>

        <Divider sx={{ borderColor: "rgba(255,255,255,0.07)" }} />

        {/* Body */}
        <Box sx={{ overflowY: "auto", px: 3, py: 2 }}>

          {/* Empty state */}
          {templates.length === 0 && (
            <Box sx={{ py: 6, textAlign: "center" }}>
              <BookmarkIcon sx={{ fontSize: 48, color: "rgba(255,255,255,0.08)", mb: 2 }} />
              <Typography variant="body1" color="text.secondary" fontWeight={600} mb={0.5}>
                Nenhum modelo criado ainda
              </Typography>
              <Typography variant="caption" color="rgba(255,255,255,0.25)" display="block" mb={3}>
                Crie modelos de treino para reutilizar em diferentes dias
              </Typography>
              <Button variant="outlined" startIcon={<AddIcon />} onClick={openNewDayTpl}
                sx={{ borderColor: "rgba(34,197,94,0.3)", color: "#22c55e", borderRadius: 2, fontWeight: 700, py: 1,
                  "&:hover": { borderColor: "#22c55e", bgcolor: "rgba(34,197,94,0.06)" } }}>
                Criar primeiro modelo
              </Button>
            </Box>
          )}

          {/* Templates grid */}
          {templates.length > 0 && (
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.5 }}>
              {templates.map((tpl) => (
                <Box key={tpl.id} sx={{
                  borderRadius: 2, overflow: "hidden",
                  border: "1px solid rgba(255,255,255,0.09)", bgcolor: "rgba(255,255,255,0.04)",
                }}>
                  <Box sx={{ px: 2, pt: 1.5, pb: 0.8, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography fontWeight={800} fontSize="0.95rem" noWrap>{tpl.name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {tpl.exercises.length} exercício{tpl.exercises.length !== 1 ? "s" : ""}
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={0.2} sx={{ flexShrink: 0, ml: 1 }}>
                      <IconButton size="small" onClick={() => openEditDayTpl(tpl)}
                        sx={{ color: "rgba(255,255,255,0.4)", p: 0.7, "&:hover": { color: "rgba(255,255,255,0.8)" } }}>
                        <EditIcon sx={{ fontSize: 17 }} />
                      </IconButton>
                      <IconButton size="small" onClick={() => deleteTpl(tpl.id)}
                        sx={{ color: "rgba(255,255,255,0.3)", p: 0.7, "&:hover": { color: "#ef4444" } }}>
                        <DeleteIcon sx={{ fontSize: 17 }} />
                      </IconButton>
                    </Stack>
                  </Box>
                  {tpl.exercises.length > 0 && (
                    <Box sx={{ px: 2, pb: 1.2, display: "flex", gap: 0.7, flexWrap: "wrap", alignItems: "center" }}>
                      {tpl.exercises.slice(0, 6).map((ex, i) => (
                        <ExerciseThumbnail key={i} machine={machines.find((m) => m.id === ex.machineId) || ex.machine} size={40} />
                      ))}
                      {tpl.exercises.length > 6 && (
                        <Box sx={{ width: 40, height: 40, borderRadius: 1.5, flexShrink: 0,
                          bgcolor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                          display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Typography fontSize="0.72rem" fontWeight={700} color="rgba(255,255,255,0.45)">
                            +{tpl.exercises.length - 6}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  )}
                  <Box sx={{ px: 1.5, pb: 1.5 }}>
                    <Button fullWidth size="small" variant="outlined"
                      onClick={() => { setApplyTpl(tpl); setApplyTplDow(null); }}
                      sx={{ py: 1.2, fontWeight: 700, borderRadius: 1.5, fontSize: "0.82rem",
                        borderColor: "rgba(34,197,94,0.22)", color: "#22c55e",
                        "&:hover": { borderColor: "rgba(34,197,94,0.5)", bgcolor: "rgba(34,197,94,0.05)" } }}>
                      Aplicar em um dia →
                    </Button>
                  </Box>
                </Box>
              ))}
            </Box>
          )}
        </Box>
      </Dialog>

      {/* Vincular com amigo */}
      <Dialog open={linkOpen} onClose={() => !linkSaving && setLinkOpen(false)} fullWidth maxWidth="xs"
        PaperProps={{ sx: { bgcolor: "#071a12", backgroundImage: "none", borderRadius: 2 } }}>
        <DialogTitle sx={{ fontWeight: 900, pb: 0.5, display: "flex", alignItems: "center", gap: 1 }}>
          <PersonAddIcon sx={{ color: "#22c55e", fontSize: 22 }} />
          Vincular rotina de amigo
        </DialogTitle>
        <DialogContent sx={{ pt: 1.5 }}>
          {!linkPreview ? (
            <>
              <Typography variant="body2" color="text.secondary" mb={2}>
                Digite o e-mail do amigo para copiar a rotina semanal dele para a sua conta.
              </Typography>
              <TextField
                label="E-mail do amigo"
                value={linkEmail}
                onChange={(e) => { setLinkEmail(e.target.value); setLinkError(""); }}
                onKeyDown={(e) => { if (e.key === "Enter" && linkEmail.trim()) fetchFriendRoutine(); }}
                size="small"
                fullWidth
                type="email"
                autoFocus
                disabled={linkLoading}
              />
              {linkError && (
                <Typography variant="caption" color="error" mt={1} display="block">{linkError}</Typography>
              )}
            </>
          ) : (
            <>
              <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: "rgba(34,197,94,0.07)", border: "1px solid rgba(34,197,94,0.2)", mb: 2 }}>
                <Typography fontWeight={800} color="#22c55e" fontSize="0.95rem">{linkPreview.name}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {linkPreview.days.length} dia{linkPreview.days.length !== 1 ? "s" : ""} com treino
                </Typography>
              </Box>
              <Stack spacing={0.8} mb={1.5}>
                {linkPreview.days.map((d) => (
                  <Box key={d.dayOfWeek} sx={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                    px: 1.5, py: 1, borderRadius: 1.5, bgcolor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                    <Box>
                      <Typography fontWeight={700} fontSize="0.85rem">
                        {["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"][d.dayOfWeek]}
                        {d.label ? ` · ${d.label}` : ""}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {d.exercises.length} exercício{d.exercises.length !== 1 ? "s" : ""}
                      </Typography>
                    </Box>
                  </Box>
                ))}
              </Stack>
              <Box sx={{ p: 1.2, borderRadius: 1.5, bgcolor: "rgba(255,193,7,0.06)", border: "1px solid rgba(255,193,7,0.15)" }}>
                <Typography variant="caption" color="rgba(255,193,7,0.8)" fontSize="0.78rem">
                  Os dias da sua rotina serão substituídos. Exercícios que você ainda não tiver serão criados automaticamente.
                </Typography>
              </Box>
              {linkError && (
                <Typography variant="caption" color="error" mt={1} display="block">{linkError}</Typography>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => { if (linkPreview) { setLinkPreview(null); setLinkError(""); } else setLinkOpen(false); }}
            sx={{ color: "rgba(255,255,255,0.5)" }} disabled={linkSaving}>
            {linkPreview ? "Voltar" : "Cancelar"}
          </Button>
          {!linkPreview ? (
            <Button variant="contained" onClick={fetchFriendRoutine}
              disabled={!linkEmail.trim() || linkLoading}>
              {linkLoading ? <CircularProgress size={18} /> : "Buscar"}
            </Button>
          ) : (
            <Button variant="contained" onClick={applyFriendRoutine} disabled={linkSaving}>
              {linkSaving ? <CircularProgress size={18} /> : "Importar rotina"}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <BottomNav />
    </Box>
  );
}
