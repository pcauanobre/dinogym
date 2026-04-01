import { useState, useEffect, useRef } from "react";
import {
  Box, Typography, Button, Stack, CircularProgress, Container,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Chip, Divider, IconButton, Checkbox,
  InputBase, MenuItem,
} from "@mui/material";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import CheckIcon from "@mui/icons-material/Check";
import FitnessCenterIcon from "@mui/icons-material/FitnessCenter";
import HistoryIcon from "@mui/icons-material/History";
import CloseIcon from "@mui/icons-material/Close";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import UndoIcon from "@mui/icons-material/Undo";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import RemoveIcon from "@mui/icons-material/Remove";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ReplayIcon from "@mui/icons-material/Replay";
import ScaleIcon from "@mui/icons-material/Scale";
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";
import SearchIcon from "@mui/icons-material/Search";
import { useNavigate } from "react-router-dom";
import WifiOffIcon from "@mui/icons-material/WifiOff";
import { CATEGORIES } from "../constants/categories.js";
import api from "../utils/api.js";
import BottomNav from "../components/BottomNav.jsx";
import { getSimDay, getSimDayOffset } from "../utils/simDay.js";
import {
  cacheRoutineDay, getCachedRoutineDay,
  cacheMachines, getCachedMachines,
  getOfflineSession, saveOfflineSession, clearOfflineSession,
  addPendingSession, syncPending,
  cacheHistory, getCachedHistory,
  cacheTodaySession, getCachedTodaySession,
} from "../utils/offlineQueue.js";
import { CATEGORY_GRADIENT, CATEGORY_COLOR } from "../constants/categories.js";
import { DAYS } from "../constants/dateLabels.js";
import { PAGE_BG } from "../constants/theme.js";
import ExerciseThumbnail from "../components/ExerciseThumbnail.jsx";
import FinishDialog from "./treino/FinishDialog.jsx";
import HistoryDialog from "./treino/HistoryDialog.jsx";
import EditEntryDialog from "./treino/EditEntryDialog.jsx";

// ─── Compressor de imagem ─────────────────────────────────────────────────────
async function compressImage(base64, maxPx = 600, quality = 0.82) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width  = Math.round(img.width  * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => resolve(base64);
    img.src = base64;
  });
}

function parseReps(str) {
  const s = String(str ?? "").trim();
  const match = s.match(/^(\d+)\s*[-–]\s*(\d+)$/);
  if (match) { const lo = parseInt(match[1]), hi = parseInt(match[2]); return { reps: Math.min(lo, hi), repsMax: Math.max(lo, hi) }; }
  const n = parseInt(s);
  return { reps: isNaN(n) ? 12 : n, repsMax: null };
}
function formatReps(reps, repsMax) { return repsMax ? `${reps}-${repsMax}` : String(reps ?? ""); }

const CONGRATS = [
  "Mais um treino no saco. Descansa!",
  "Arrasou hoje! Consistência é tudo.",
  "Treino concluído. Cada rep conta.",
  "Você ganhou hoje. Bora recuperar!",
  "Disciplina bate motivação todo dia.",
];


/* ─── Página principal ─── */
export default function Treino() {
  const navigate = useNavigate();
  const dow = getSimDay();

  const [session, setSession]   = useState(() => getCachedTodaySession());
  const [routine, setRoutine]   = useState(() => getCachedRoutineDay(dow));
  const [loading, setLoading]   = useState(true);
  const [isOffline, setIsOffline]         = useState(false);
  const [showOfflineBanner, setShowOfflineBanner] = useState(false);

  // Log dialog
  const [logEx, setLogEx]               = useState(null);
  const [saving, setSaving]             = useState(false);
  const [weightUnit, setWeightUnit]     = useState("kg"); // "kg" | "placas"

  // Edit mode
  const [editEx, setEditEx]             = useState(null);
  const [editSaving, setEditSaving]     = useState(false);

  // Finish dialog
  const [finishDialog, setFinishDialog] = useState(false);

  // Today override (edit routine for today only)
  const TODAY_OVERRIDE_KEY = `dg_today_ex_${new Date().toISOString().split("T")[0]}`;
  const [editingToday, setEditingToday]           = useState(false);
  const [overrideExercises, setOverrideExercises] = useState(() => {
    const stored = localStorage.getItem(`dg_today_ex_${new Date().toISOString().split("T")[0]}`);
    return stored ? JSON.parse(stored) : null;
  });
  const [todayMachines, setTodayMachines] = useState(() => getCachedMachines());
  const [addTodayOpen, setAddTodayOpen]   = useState(false);
  const [confirmDeleteMachineId, setConfirmDeleteMachineId] = useState(null);

  // Skip today
  const [skippedToday, setSkippedToday] = useState(() => {
    const key = `dg_skip_${new Date().toISOString().split("T")[0]}`;
    return localStorage.getItem(key) === "1";
  });
  const [startingSession, setStartingSession] = useState(false);

  const SIM_SESSION_KEY    = `dg_sim_session_${getSimDayOffset()}`;
  const SESSION_START_KEY  = `dg_session_start_${getSimDayOffset()}`;
  const CUSTOM_KEY         = `dg_custom_${new Date().toISOString().split("T")[0]}`;

  const [isCustomWorkout, setIsCustomWorkout] = useState(() => localStorage.getItem(`dg_custom_${new Date().toISOString().split("T")[0]}`) === "1");
  const [addCustomOpen, setAddCustomOpen]     = useState(false);

  // PR suggestion
  const [prSuggestion, setPrSuggestion] = useState(null); // { machineId, machineName, oldPR, newPR }

  // History dialog — inicializado do cache para abertura instantânea
  const [historyOpen, setHistoryOpen]           = useState(false);
  const [history, setHistory]                   = useState(() => getCachedHistory());
  const [historyLoading, setHistoryLoading]     = useState(false);
  const [selectedHistSess, setSelectedHistSess] = useState(() => { const h = getCachedHistory(); return h?.length ? h[0] : null; });

  // Fix 1+5: confirmation before leaving
  const [confirmBackOpen, setConfirmBackOpen] = useState(false);
  const [confirmIncompleteOpen, setConfirmIncompleteOpen] = useState(false);
  const [confirmResetSessionOpen, setConfirmResetSessionOpen] = useState(false);

  // Refazer treino
  const [confirmRedoWorkout, setConfirmRedoWorkout] = useState(false);

  // Lazy session start — store the exercise to log, start session, auto-open log via useEffect
  const [pendingLogEx, setPendingLogEx] = useState(null);

  // PR prompt (primeiro log sem PR)
  const [prPromptEx, setPrPromptEx]       = useState(null);
  const [prPromptValue, setPrPromptValue] = useState("");
  const [prPromptStep, setPrPromptStep]   = useState("ask"); // "ask" | "enter"

  const [simpleSets, setSimpleSets] = useState([]);

  // Fix 2: reorder exercises
  const fileInputRef = useRef();
  const photoPreviewFileRef = useRef();

  // Fix 3+4+7: edit exercise info (name, PR, sets, reps)
  const [editInfoEx, setEditInfoEx] = useState(null); // exercise being edited
  const [editInfoName, setEditInfoName] = useState("");
  const [editInfoPR, setEditInfoPR] = useState("");
  const [editInfoSets, setEditInfoSets] = useState("");
  const [editInfoReps, setEditInfoReps] = useState("");
  const [editInfoRepsMax, setEditInfoRepsMax] = useState("");
  const [editInfoSaving, setEditInfoSaving] = useState(false);

  // Fix 4: photo preview
  const [photoPreview, setPhotoPreview] = useState(null); // { machine }

  // Fix 9: previous workout data
  const [prevWorkout, setPrevWorkout] = useState({}); // { machineId: { weight, reps, setsData } }
  const [expandedExId, setExpandedExId] = useState(null);

  // Fix 11: search/filter in add exercise dialog
  const [addSearch, setAddSearch] = useState("");
  const [addFilter, setAddFilter] = useState("Todos");
  const [addNewOpen, setAddNewOpen] = useState(false);
  const [newExName, setNewExName] = useState("");
  const [newExCategory, setNewExCategory] = useState("");

  // ─── Drag-to-reorder ──────────────────────────────────────────────────────
  const dragRef         = useRef({ active: false, idx: -1, startY: 0, hoverIdx: -1, count: 0 });
  const stateRef        = useRef({});
  const listRef         = useRef(null);
  const longPressTimer  = useRef(null);
  const [draggingIdx,   setDraggingIdx]   = useState(-1);
  const [dragOffsetY,   setDragOffsetY]   = useState(0);
  const [dropTargetIdx, setDropTargetIdx] = useState(-1);
  const ITEM_H = 108; // approx card height + gap

  const congratsMsg = CONGRATS[new Date().getDay() % CONGRATS.length];

  useEffect(() => {
    async function load() {
      try {
        // Simulação: só precisa de rotina e máquinas, sessão vem do localStorage
        const isSim = getSimDayOffset() > 0;
        // history em paralelo — elimina o waterfall anterior
        const [sesRes, routRes, machRes, histRes] = await Promise.all([
          isSim ? Promise.resolve({ data: null }) : api.get("/sessions/today"),
          api.get(`/routine/day/${dow}`),
          api.get("/machines"),
          api.get("/sessions/history"),
        ]);
        if (isSim) {
          const storedSim = localStorage.getItem(SIM_SESSION_KEY);
          setSession(storedSim ? JSON.parse(storedSim) : null);
        } else {
          setSession(sesRes.data);
          cacheTodaySession(sesRes.data);
        }
        setRoutine(routRes.data);
        cacheMachines(machRes.data);
        setTodayMachines(machRes.data);
        if (routRes.data) cacheRoutineDay(dow, routRes.data);
        // Processar histórico (agora em paralelo com os demais)
        const histData = histRes.data || [];
        cacheHistory(histData);
        setHistory(histData);
        if (histData.length) setSelectedHistSess((prev) => prev ?? histData[0]);
        const prevMap = {};
        const todayStr = new Date().toISOString().split("T")[0];
        for (const sess of histData) {
          if (sess.date?.split("T")[0] === todayStr) continue;
          for (const entry of (sess.entries || [])) {
            if (!prevMap[entry.machineId]) prevMap[entry.machineId] = entry;
          }
        }
        setPrevWorkout(prevMap);
        setLoading(false);
      } catch {
        // Server unreachable — use cached data
        setIsOffline(true);
        setShowOfflineBanner(true);
        const cachedRoutine   = getCachedRoutineDay(dow);
        let offlineSession    = getOfflineSession();
        // If no offline session exists yet, create one for this workout
        if (!offlineSession) {
          offlineSession = { id: "offline", date: new Date().toISOString(), entries: [], finished: false };
          saveOfflineSession(offlineSession);
        }
        setRoutine(cachedRoutine);
        setSession(offlineSession);
        setLoading(false);
      }
    }

    load();

    // Auto-sync when connectivity is restored
    function handleOnline() { syncPending().catch(() => {}); }
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [dow]);

  // Disable pull-to-refresh on mobile browsers
  useEffect(() => {
    const prev = document.body.style.overscrollBehaviorY;
    document.body.style.overscrollBehaviorY = "none";
    return () => { document.body.style.overscrollBehaviorY = prev; };
  }, []);

  // Auto-open log after lazy session creation
  useEffect(() => {
    if (session && !session.finished && pendingLogEx) {
      const ex = pendingLogEx;
      setPendingLogEx(null);
      openLog(ex);
    }
  }, [session?.id]); // eslint-disable-line

  // ─── Drag useEffect (refs only → no stale closures) ────────────────────────
  useEffect(() => {
    function onMove(e) {
      if (!dragRef.current.active) return;
      e.preventDefault();
      const dy = e.clientY - dragRef.current.startY;
      const newHover = Math.max(0, Math.min(dragRef.current.count - 1,
        Math.round(dragRef.current.idx + dy / ITEM_H)));
      dragRef.current.hoverIdx = newHover;
      setDragOffsetY(dy);
      setDropTargetIdx(newHover);
      const el = listRef.current;
      if (el) {
        const r = el.getBoundingClientRect();
        if (e.clientY > r.bottom - 60) el.scrollTop += 5;
        if (e.clientY < r.top + 60) el.scrollTop -= 5;
      }
    }
    function onUp() {
      if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
      if (!dragRef.current.active) return;
      const { idx, hoverIdx } = dragRef.current;
      dragRef.current = { active: false, idx: -1, startY: 0, hoverIdx: -1, count: 0 };
      setDraggingIdx(-1); setDragOffsetY(0); setDropTargetIdx(-1);
      if (hoverIdx !== idx && hoverIdx >= 0) {
        const { isCustomWorkout: cw, session: sess, overrideExercises: ovr, routine: rtn, TODAY_OVERRIDE_KEY: todayKey } = stateRef.current;
        const base = cw
          ? (sess?.entries?.map((e) => ({ id: e.id, machineId: e.machineId, machine: e.machine, sets: e.sets || 3, reps: e.reps || 12 })) || [])
          : (ovr ?? rtn?.exercises ?? []);
        const list = [...base];
        const [removed] = list.splice(idx, 1);
        list.splice(hoverIdx, 0, removed);
        setOverrideExercises(list);
        localStorage.setItem(todayKey, JSON.stringify(list));
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
  }, []); // refs only — no deps needed

  function onDragHandleDown(e, idx) {
    e.preventDefault();
    e.stopPropagation();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
    const y = e.clientY;
    const count = stateRef.current.overrideExercises?.length ?? stateRef.current.routine?.exercises?.length ?? 0;
    dragRef.current = { active: true, idx, startY: y, hoverIdx: idx, count };
    setDraggingIdx(idx);
    setDropTargetIdx(idx);
    setDragOffsetY(0);
  }

  // ─── Edição retroativa de entrada do histórico ───────────────────────────
  async function handleEditSession(sessionId, entryId, patch) {
    const r = await api.patch(`/sessions/${sessionId}/entries/${entryId}`, patch);
    setHistory((prev) => prev?.map((s) => s.id === sessionId
      ? { ...s, entries: s.entries.map((e) => e.id === entryId ? r.data : e) }
      : s
    ) ?? prev);
    setSelectedHistSess((prev) => prev?.id === sessionId
      ? { ...prev, entries: prev.entries.map((e) => e.id === entryId ? r.data : e) }
      : prev
    );
  }

  async function handleCreateSession(dateStr) {
    const r = await api.post("/sessions", { date: dateStr });
    const newSess = { ...r.data, entries: r.data.entries || [] };
    setHistory((prev) => {
      const updated = [newSess, ...(prev || [])].sort((a, b) => new Date(b.date) - new Date(a.date));
      cacheHistory(updated);
      return updated;
    });
    setSelectedHistSess(newSess);
  }

  async function handleAddEntry(sessionId, data) {
    const r = await api.post(`/sessions/${sessionId}/entries`, data);
    const newEntry = r.data;
    setHistory((prev) => prev?.map((s) => s.id === sessionId
      ? { ...s, entries: [...s.entries, newEntry] }
      : s
    ) ?? prev);
    setSelectedHistSess((prev) => prev?.id === sessionId
      ? { ...prev, entries: [...prev.entries, newEntry] }
      : prev
    );
    return newEntry;
  }

  async function handleDeleteSession(sessionId) {
    await api.delete(`/sessions/${sessionId}`);
    setHistory((prev) => prev?.filter((s) => s.id !== sessionId) ?? prev);
    // Se o treino apagado era o de hoje, limpa a sessão ativa
    if (session?.id === sessionId) {
      setSession(null);
      cacheTodaySession(null);
    }
    // HistoryDialog handles onSelectSession to show _empty for the deleted date
  }

  async function startSession() {
    setStartingSession(true);
    // Simulação: sessão 100% local, sem tocar no backend
    if (getSimDayOffset() > 0) {
      const simSess = { id: `sim_${Date.now()}`, date: new Date().toISOString(), entries: [], finished: false };
      setSession(simSess);
      localStorage.setItem(SIM_SESSION_KEY, JSON.stringify(simSess));
      localStorage.setItem(SESSION_START_KEY, Date.now().toString());
      setStartingSession(false);
      return;
    }
    try {
      const r = await api.post("/sessions");
      setSession(r.data);
      localStorage.setItem(SESSION_START_KEY, Date.now().toString());
    } catch {
      const offSess = { id: "offline", date: new Date().toISOString(), entries: [], finished: false };
      saveOfflineSession(offSess);
      setSession(offSess);
      setIsOffline(true);
      setShowOfflineBanner(true);
    } finally {
      setStartingSession(false);
    }
  }

  async function startCustomSession() {
    localStorage.setItem(CUSTOM_KEY, "1");
    setIsCustomWorkout(true);
    await startSession();
  }

  function cancelCustomWorkout() {
    localStorage.removeItem(CUSTOM_KEY);
    localStorage.removeItem(SESSION_START_KEY);
    setIsCustomWorkout(false);
    setSession(null);
  }

  // Back button: exit directly keeping progress (no dialog)
  function handleBackPress() {
    handleBackConfirmExit();
  }

  function handleBackConfirmExit() {
    // Keep session (entries are saved), just navigate away
    setConfirmBackOpen(false);
    navigate("/app");
  }

  async function doDeleteSession() {
    const deletedId = session?.id;
    try {
      if (!isCustomWorkout && session?.id !== "offline" && getSimDayOffset() === 0) {
        await api.delete("/sessions/today");
      }
    } catch { /* ignore */ }
    if (isCustomWorkout) {
      localStorage.removeItem(CUSTOM_KEY);
      setIsCustomWorkout(false);
    }
    localStorage.removeItem(SESSION_START_KEY);
    setConfirmBackOpen(false);
    setSession(null);
    cacheTodaySession(null);
    if (deletedId) setHistory((prev) => prev?.filter((s) => s.id !== deletedId) ?? prev);
  }

  async function redoWorkout() {
    setConfirmRedoWorkout(false);
    const isSim = getSimDayOffset() > 0;
    if (isSim) {
      const simSess = { id: `sim_${Date.now()}`, date: new Date().toISOString(), entries: [], finished: false };
      setSession(simSess);
      localStorage.setItem(SIM_SESSION_KEY, JSON.stringify(simSess));
      localStorage.setItem(SESSION_START_KEY, Date.now().toString());
      return;
    }
    try {
      if (session?.id && session.id !== "offline") {
        await api.delete("/sessions/today");
      }
      const r = await api.post("/sessions");
      setSession(r.data);
      localStorage.setItem(SESSION_START_KEY, Date.now().toString());
    } catch {
      const offSess = { id: "offline", date: new Date().toISOString(), entries: [], finished: false };
      saveOfflineSession(offSess);
      setSession(offSess);
      setIsOffline(true);
      setShowOfflineBanner(true);
    }
  }

  function skipToday() {
    const key = `dg_skip_${new Date().toISOString().split("T")[0]}`;
    localStorage.setItem(key, "1");
    setSkippedToday(true);
  }

  function startEditingToday() {
    if (!overrideExercises) {
      const current = routine?.exercises || [];
      setOverrideExercises(current);
      localStorage.setItem(TODAY_OVERRIDE_KEY, JSON.stringify(current));
    }
    setEditingToday(true);
  }

  function removeTodayExercise(machineId) {
    const base = overrideExercises ?? routine?.exercises ?? [];
    const newList = base.filter((ex) => ex.machine.id !== machineId);
    setOverrideExercises(newList);
    localStorage.setItem(TODAY_OVERRIDE_KEY, JSON.stringify(newList));
  }

  function restoreTodayRoutine() {
    localStorage.removeItem(TODAY_OVERRIDE_KEY);
    setOverrideExercises(null);
    setEditingToday(false);
  }

  // Fix 2: reorder exercises
  function moveExercise(idx, dir) {
    const base = overrideExercises ?? routine?.exercises ?? [];
    if (!overrideExercises) {
      setOverrideExercises([...base]);
      localStorage.setItem(TODAY_OVERRIDE_KEY, JSON.stringify(base));
    }
    const list = [...(overrideExercises ?? base)];
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= list.length) return;
    [list[idx], list[newIdx]] = [list[newIdx], list[idx]];
    setOverrideExercises(list);
    localStorage.setItem(TODAY_OVERRIDE_KEY, JSON.stringify(list));
  }

  // Fix 3+4+7: open exercise info edit dialog
  function openExerciseInfo(ex) {
    setEditInfoEx(ex);
    setEditInfoName(ex.machine.name);
    setEditInfoPR(ex.machine.currentPR != null ? String(ex.machine.currentPR) : "");
    setEditInfoSets(String(ex.sets || 3));
    setEditInfoReps(formatReps(ex.reps || 12, ex.repsMax));
    setEditInfoRepsMax(ex.repsMax != null ? String(ex.repsMax) : "");
  }

  async function saveExerciseInfo() {
    if (!editInfoEx) return;
    setEditInfoSaving(true);
    const machineId = editInfoEx.machine.id;
    const newSets    = parseInt(editInfoSets)    || editInfoEx.sets  || 3;
    const parsed     = parseReps(editInfoReps);
    const newReps    = parsed.reps;
    const newRepsMax = parsed.repsMax;

    // 1. Atualiza máquina (nome, PR)
    const machineData = {};
    if (editInfoName.trim() && editInfoName.trim() !== editInfoEx.machine.name) machineData.name = editInfoName.trim();
    if (editInfoPR !== "" && parseFloat(editInfoPR) !== editInfoEx.machine.currentPR) machineData.currentPR = parseFloat(editInfoPR);
    if (editInfoPR === "" && editInfoEx.machine.currentPR != null) machineData.currentPR = null;
    try {
      if (Object.keys(machineData).length > 0 && getSimDayOffset() === 0) {
        await api.patch(`/machines/${machineId}`, machineData);
      }
    } catch { /* ignore */ }

    // 2. Atualiza rotina (séries/reps) se o exercício fizer parte dela
    const routineExs = routine?.exercises ?? [];
    if (routineExs.some((ex) => ex.machine?.id === machineId)) {
      const updatedRoutineExs = routineExs.map((ex) =>
        ex.machine?.id === machineId
          ? { ...ex, sets: newSets, reps: newReps, repsMax: newRepsMax }
          : ex
      );
      try {
        if (getSimDayOffset() === 0) {
          await api.put(`/routine/day/${dow}`, {
            label: routine?.label,
            exercises: updatedRoutineExs.map((ex) => ({
              machineId: ex.machine?.id || ex.machineId,
              sets:    ex.sets,
              reps:    ex.reps,
              repsMax: ex.repsMax ?? null,
            })),
          });
        }
      } catch { /* ignore */ }
    }

    // 3. Atualiza estado local
    const updatedMachine = { ...editInfoEx.machine, ...machineData, name: editInfoName.trim() || editInfoEx.machine.name };
    setTodayMachines((prev) => prev.map((m) => m.id === machineId ? { ...m, ...updatedMachine } : m));
    setRoutine((prev) => {
      if (!prev?.exercises) return prev;
      return { ...prev, exercises: prev.exercises.map((ex) =>
        ex.machine?.id === machineId
          ? { ...ex, machine: updatedMachine, sets: newSets, reps: newReps, repsMax: newRepsMax }
          : ex
      )};
    });
    const updateEx = (ex) => ex.machine?.id === machineId
      ? { ...ex, machine: updatedMachine, sets: newSets, reps: newReps, repsMax: newRepsMax }
      : ex;
    if (overrideExercises) {
      const newOverride = overrideExercises.map(updateEx);
      setOverrideExercises(newOverride);
      localStorage.setItem(TODAY_OVERRIDE_KEY, JSON.stringify(newOverride));
    }
    setSession((prev) => {
      if (!prev?.entries) return prev;
      return { ...prev, entries: prev.entries.map((e) =>
        e.machineId === machineId ? { ...e, machine: updatedMachine } : e
      )};
    });
    setEditInfoSaving(false);
    setEditInfoEx(null);
  }

  function handleInfoPhotoChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const compressed = await compressImage(ev.target.result);
      setEditInfoPhoto(compressed);
    };
    reader.readAsDataURL(file);
  }

  // Fix 11: create new exercise from add dialog
  async function handleCreateNewExercise() {
    if (!newExName.trim() || !newExCategory) return;
    try {
      const r = await api.post("/machines", { name: newExName.trim(), category: newExCategory });
      setTodayMachines((prev) => [r.data, ...prev]);
      setAddNewOpen(false);
      setNewExName("");
      setNewExCategory("");
      // Auto-add this exercise
      if (addCustomOpen) {
        addCustomExercise(r.data);
      } else {
        addTodayExercise(r.data);
      }
    } catch { /* ignore */ }
  }

  function addCustomExercise(machine) {
    setAddCustomOpen(false);
    setAddTodayOpen(false);
    const ex = { id: `custom_${Date.now()}`, machineId: machine.id, machine, sets: 3, reps: 12 };
    openLog(ex);
  }

  function addTodayExercise(machine) {
    const base = overrideExercises ?? routine?.exercises ?? [];
    const newEx = { id: `today_${Date.now()}`, machineId: machine.id, machine, sets: 3, reps: 12 };
    const newList = [...base, newEx];
    setOverrideExercises(newList);
    localStorage.setItem(TODAY_OVERRIDE_KEY, JSON.stringify(newList));
    setAddTodayOpen(false);
  }

  function doOpenLog(ex) {
    // Initialize simple mode sets (pre-filled from previous workout or defaults)
    const prevEntry = prevWorkout[ex.machine.id];
    let initSets;
    if (prevEntry) {
      let sd = prevEntry.setsData;
      if (typeof sd === "string") { try { sd = JSON.parse(sd); } catch { sd = null; } }
      if (Array.isArray(sd) && sd.length > 0) {
        initSets = Array.from({ length: ex.sets || 3 }, (_, i) => ({
          weight: (sd[i]?.weight ?? prevEntry.weight) ?? "",
          reps: sd[i]?.reps ?? ex.reps,
        }));
      } else {
        initSets = Array.from({ length: ex.sets || 3 }, () => ({
          weight: prevEntry.weight ?? ex.machine.currentPR ?? "",
          reps: prevEntry.reps ?? ex.reps,
        }));
      }
    } else {
      initSets = Array.from({ length: ex.sets || 3 }, () => ({
        weight: ex.machine.currentPR ?? "",
        reps: ex.reps,
      }));
    }
    setSimpleSets(initSets);
    setWeightUnit(localStorage.getItem(`dg_weight_unit_${ex.machine.id}`) || "kg");
    setLogEx(ex);
  }

  function openLog(ex, skipPrPrompt = false) {
    if (!skipPrPrompt && ex.machine.currentPR == null) {
      setPrPromptEx(ex);
      setPrPromptValue("");
      setPrPromptStep("ask");
      return;
    }
    doOpenLog(ex);
  }

  function handleDialogClose() {
    if (!saving) setLogEx(null);
  }

  async function commitEntry(setsDataArr, comment) {
    setSaving(true);
    const realSets      = setsDataArr.filter((s) => !s.skipped);
    const weights       = realSets.map((s) => s.weight).filter(Boolean);
    const maxWeight     = weights.length > 0 ? Math.max(...weights) : 0;
    const pr            = logEx.machine.currentPR;
    const isPlacas      = realSets.some((s) => s.unit === "placas") || weightUnit === "placas";
    // Fix 10: não conta PR se é o primeiro treino (PR não definido antes). Placas não geram PR.
    const hitPR         = !isPlacas && realSets.length > 0 && pr != null && maxWeight > pr;
    const isFirstTime   = !isPlacas && pr == null && maxWeight > 0;
    const notes         = realSets.length > 0 && !hitPR && pr != null && maxWeight < pr ? "regrediu" : null;
    const isSim         = getSimDayOffset() > 0;
    // PR suggestion: se anotou peso acima do PR atual → sugere atualizar (nunca no primeiro treino)
    const shouldAskPR   = hitPR && maxWeight > 0;
    const prSnapshot    = shouldAskPR ? { machineId: logEx.machine.id, machineName: logEx.machine.name, oldPR: pr, newPR: maxWeight } : null;

    // Simulação ou offline: entry local, sem API
    if (isSim || isOffline || session?.id === "offline") {
      const entry = {
        id: `${isSim ? "sim" : "offline"}_${Date.now()}`,
        machineId: logEx.machine.id,
        machine: logEx.machine,
        weight: maxWeight,
        sets: logEx.sets,
        reps: logEx.reps,
        hitPR,
        notes,
        previousPR: pr,
        setsData: JSON.stringify(setsDataArr),
        comment,
        createdAt: new Date().toISOString(),
      };
      const prevEntries = (session?.entries || []).filter((e) => e.machineId !== logEx.machine.id);
      const updated = { ...session, entries: [...prevEntries, entry] };
      setSession(updated);
      if (isSim) {
        localStorage.setItem(SIM_SESSION_KEY, JSON.stringify(updated));
      } else {
        saveOfflineSession(updated);
      }
      if (prSnapshot) setPrSuggestion(prSnapshot);
      // Fix 10: silently set initial PR on first workout
      if (isFirstTime) {
        setTodayMachines((prev) => prev.map((m) => m.id === logEx.machine.id ? { ...m, currentPR: maxWeight } : m));
        if (!isSim) { try { await api.patch(`/machines/${logEx.machine.id}`, { currentPR: maxWeight }); } catch {} }
      }
      setSaving(false);
      setLogEx(null);
      return;
    }

    try {
      const r = await api.post(`/sessions/${session.id}/entries`, {
        machineId: logEx.machine.id,
        weight: maxWeight,
        sets: logEx.sets,
        reps: logEx.reps,
        hitPR,
        notes,
        setsData: setsDataArr,
        comment,
      });
      const prevEntries = (session.entries || []).filter((e) => e.machineId !== logEx.machine.id);
      const updatedSession = { ...session, entries: [...prevEntries, r.data] };
      setSession(updatedSession);
      if (prSnapshot) setPrSuggestion(prSnapshot);
      // Fix 10: silently set initial PR on first workout
      if (isFirstTime) {
        try { await api.patch(`/machines/${logEx.machine.id}`, { currentPR: maxWeight }); } catch {}
        setTodayMachines((prev) => prev.map((m) => m.id === logEx.machine.id ? { ...m, currentPR: maxWeight } : m));
      }
    } catch (err) {
      let recovered = false;
      if (err?.response?.status === 404) {
        try {
          const newSess = await api.post("/sessions");
          const r2 = await api.post(`/sessions/${newSess.data.id}/entries`, {
            machineId: logEx.machine.id,
            weight: maxWeight,
            sets: logEx.sets,
            reps: logEx.reps,
            hitPR,
            notes,
            setsData: setsDataArr,
            comment,
          });
          const upd = { ...newSess.data, entries: [...(newSess.data.entries || []), r2.data] };
          setSession(upd);
          recovered = true;
        } catch { /* fall through to offline */ }
      }
      if (!recovered) {
        setIsOffline(true);
        setShowOfflineBanner(true);
        const entry = {
          id: `offline_${Date.now()}`,
          machineId: logEx.machine.id,
          machine: logEx.machine,
          weight: maxWeight,
          sets: logEx.sets,
          reps: logEx.reps,
          hitPR,
          notes,
          previousPR: pr,
          setsData: JSON.stringify(setsDataArr),
          comment,
          createdAt: new Date().toISOString(),
        };
        const updated = { ...session, entries: [...(session?.entries || []), entry] };
        setSession(updated);
        saveOfflineSession({ ...updated, _realSessionId: session.id });
        if (prSnapshot) setPrSuggestion(prSnapshot);
      }
    }
    setSaving(false);
    setLogEx(null);
  }

  async function finishSession(dayRating, nutrition) {
    setSaving(true);
    const isSim = getSimDayOffset() > 0;

    // Simulação: tudo local, sem backend
    if (isSim) {
      const startTs = parseInt(localStorage.getItem(SESSION_START_KEY) || "0");
      const durationSec = startTs > 0 ? Math.floor((Date.now() - startTs) / 1000) : null;
      const finished = { ...session, finished: true, dayRating, nutrition, duration: durationSec };
      setSession(finished);
      localStorage.setItem(SIM_SESSION_KEY, JSON.stringify(finished));
      localStorage.removeItem(SESSION_START_KEY);
      setSaving(false);
      setFinishDialog(false);
      return;
    }

    if (isOffline || session?.id === "offline") {
      const stored         = getOfflineSession() || session;
      const realSessionId  = stored._realSessionId || null;
      const entriesToSync  = (session?.entries || [])
        .filter((e) => !realSessionId || String(e.id).startsWith("offline_"))
        .map((e) => ({
          machineId: e.machineId || e.machine?.id,
          weight: e.weight,
          sets: e.sets,
          reps: e.reps,
          hitPR: e.hitPR,
          notes: e.notes,
          setsData: e.setsData ? JSON.parse(e.setsData) : undefined,
          comment: e.comment,
        }));

      addPendingSession({
        sessionId: realSessionId,
        date: stored.date || new Date().toISOString(),
        entries: entriesToSync,
        dayRating,
        nutrition,
      });
      clearOfflineSession();
      setSession((prev) => ({ ...prev, finished: true, dayRating, nutrition }));
      setSaving(false);
      setFinishDialog(false);
      return;
    }

    try {
      const startTs = parseInt(localStorage.getItem(SESSION_START_KEY) || "0");
      const durationSec = startTs > 0 ? Math.floor((Date.now() - startTs) / 1000) : null;
      const r = await api.patch(`/sessions/${session.id}/finish`, { dayRating, nutrition, duration: durationSec });
      localStorage.removeItem(SESSION_START_KEY);
      setSession(r.data);
      // Adicionar sessão finalizada ao histórico local imediatamente
      const finishedSess = r.data;
      setHistory((prev) => {
        const without = (prev || []).filter((s) => s.id !== finishedSess.id);
        const updated = [finishedSess, ...without].sort((a, b) => new Date(b.date) - new Date(a.date));
        cacheHistory(updated);
        return updated;
      });
      setSelectedHistSess(finishedSess);
    } catch {
      setIsOffline(true);
      setShowOfflineBanner(true);
      addPendingSession({
        sessionId: session.id,
        date: session.date,
        entries: [],
        dayRating,
        nutrition,
      });
      setSession((prev) => ({ ...prev, finished: true, dayRating, nutrition }));
    }
    setSaving(false);
    setFinishDialog(false);
  }

  async function confirmPRUpdate() {
    if (!prSuggestion) return;
    const { machineId, newPR } = prSuggestion;
    try {
      if (getSimDayOffset() === 0) {
        await api.patch(`/machines/${machineId}`, { currentPR: newPR });
      }
    } catch { /* ignore */ }
    // Fix 8: update PR in ALL state references
    const updateMachinePR = (m) => m.id === machineId ? { ...m, currentPR: newPR } : m;
    setTodayMachines((prev) => prev.map(updateMachinePR));
    // Update routine exercises
    setRoutine((prev) => {
      if (!prev?.exercises) return prev;
      return { ...prev, exercises: prev.exercises.map((ex) =>
        ex.machine?.id === machineId ? { ...ex, machine: { ...ex.machine, currentPR: newPR } } : ex
      )};
    });
    // Update override exercises
    if (overrideExercises) {
      const newOverride = overrideExercises.map((ex) =>
        ex.machine?.id === machineId ? { ...ex, machine: { ...ex.machine, currentPR: newPR } } : ex
      );
      setOverrideExercises(newOverride);
      localStorage.setItem(TODAY_OVERRIDE_KEY, JSON.stringify(newOverride));
    }
    // Update session entries
    setSession((prev) => {
      if (!prev?.entries) return prev;
      return { ...prev, entries: prev.entries.map((e) =>
        e.machineId === machineId ? { ...e, machine: { ...e.machine, currentPR: newPR } } : e
      )};
    });
    setPrSuggestion(null);
  }

  async function openHistory() {
    setHistoryOpen(true);
    // history já foi carregado no useEffect junto com os outros dados
    if (history) return;
    // Fallback: buscar se por algum motivo ainda não foi carregado
    setHistoryLoading(true);
    try {
      const r = await api.get("/sessions/history");
      cacheHistory(r.data);
      setHistory(r.data);
      if (r.data?.length) setSelectedHistSess(r.data[0]);
    } finally {
      setHistoryLoading(false);
    }
  }

  function isLogged(machineId)  { return session?.entries?.some((e) => e.machineId === machineId); }
  function getEntry(machineId)  { return session?.entries?.find((e) => e.machineId === machineId); }

  function reopenLog(ex) {
    const updated = { ...session, entries: (session.entries || []).filter((e) => e.machineId !== ex.machine.id) };
    setSession(updated);
    if (getSimDayOffset() > 0) localStorage.setItem(SIM_SESSION_KEY, JSON.stringify(updated));
    doOpenLog(ex);
  }

  function isPartial(ex) {
    const entry = getEntry(ex.machine.id);
    if (!entry) return false;
    let sd = entry.setsData;
    if (typeof sd === "string") { try { sd = JSON.parse(sd); } catch { return false; } }
    return Array.isArray(sd) && sd.length > 0 && sd.length < ex.sets;
  }

  function continueLog(ex) {
    const entry = getEntry(ex.machine.id);
    if (!entry) { openLog(ex); return; }
    let sd = entry.setsData;
    if (typeof sd === "string") { try { sd = JSON.parse(sd); } catch { sd = []; } }
    if (!Array.isArray(sd)) sd = [];
    // Pre-fill simple mode with already-logged sets + remaining from routine
    const totalSets = ex.sets || 3;
    const initSets = Array.from({ length: totalSets }, (_, i) => ({
      weight: (sd[i]?.weight ?? entry.weight) ?? ex.machine.currentPR ?? "",
      reps: sd[i]?.reps ?? ex.reps,
    }));
    setSimpleSets(initSets);
    setWeightUnit(localStorage.getItem(`dg_weight_unit_${ex.machine.id}`) || "kg");
    setLogEx(ex);
  }

  function openEditMode(ex) {
    const entry = getEntry(ex.machine.id);
    if (!entry) return;
    let setsData = entry.setsData;
    if (typeof setsData === "string") { try { setsData = JSON.parse(setsData); } catch { setsData = []; } }
    if (!Array.isArray(setsData) || setsData.length === 0) {
      setsData = [{ weight: entry.weight, reps: entry.reps || ex.reps, isBackOff: false }];
    }
    setEditEx({ ...ex, _initialSets: setsData, _initialComment: entry.comment || "" });
  }

  async function handleEditSave(editSets, editComment) {
    setEditSaving(true);
    const machineId = editEx.machine.id;
    const entriesWithout = (session.entries || []).filter((e) => e.machineId !== machineId);
    const sessionWithout = { ...session, entries: entriesWithout };
    const realSets  = editSets.filter((s) => !s.skipped);
    const weights   = realSets.map((s) => s.weight).filter(Boolean);
    const maxWeight = weights.length > 0 ? Math.max(...weights) : 0;
    const pr        = editEx.machine.currentPR;
    const hitPR     = realSets.length > 0 && pr != null && maxWeight > pr;
    const notes     = realSets.length > 0 && !hitPR && pr != null && maxWeight < pr ? "regrediu" : null;
    const isSim     = getSimDayOffset() > 0;

    const makeLocalEntry = () => ({
      id: `${isSim ? "sim" : "offline"}_${Date.now()}`, machineId, machine: editEx.machine,
      weight: maxWeight, sets: editEx.sets, reps: editEx.reps,
      hitPR, notes, previousPR: pr,
      setsData: JSON.stringify(editSets), comment: editComment,
      createdAt: new Date().toISOString(),
    });

    if (isSim || isOffline || session?.id === "offline") {
      const updated = { ...sessionWithout, entries: [...entriesWithout, makeLocalEntry()] };
      setSession(updated);
      if (isSim) localStorage.setItem(SIM_SESSION_KEY, JSON.stringify(updated));
      else saveOfflineSession(updated);
      setEditSaving(false); setEditEx(null); return;
    }
    try {
      const r = await api.post(`/sessions/${session.id}/entries`, {
        machineId, weight: maxWeight, sets: editEx.sets, reps: editEx.reps,
        hitPR, notes, setsData: editSets, comment: editComment,
      });
      const updated = { ...sessionWithout, entries: [...entriesWithout, r.data] };
      setSession(updated);
    } catch {
      setIsOffline(true); setShowOfflineBanner(true);
      const updated = { ...sessionWithout, entries: [...entriesWithout, makeLocalEntry()] };
      setSession(updated); saveOfflineSession(updated);
    }
    setEditSaving(false); setEditEx(null);
  }

  function handleEditRedo(ex) {
    setEditEx(null);
    reopenLog(ex);
  }

  function calcEvolution(entry, ex) {
    const pr = entry.previousPR;
    if (pr == null || pr === 0) return null;

    let setsData = entry.setsData;
    if (typeof setsData === "string") { try { setsData = JSON.parse(setsData); } catch { setsData = null; } }

    // Baseline: mínimo do range (neutro = acertou o mínimo programado)
    const programmedReps = ex.reps ?? 1;
    const totalSets      = ex.sets || 1;

    if (Array.isArray(setsData) && setsData.length > 0) {
      const realSets = setsData.filter((s) => !s.skipped);
      if (realSets.length === 0) return -100;

      // Back-off SUBSTITUI uma série principal quando não dá pra manter a carga.
      // Peso/reps do back-off são intencionalmente menores → não representam força.
      // Mas back-off AINDA conta como ter feito a série (completion = ok).
      const mainSets = realSets.filter((s) => !s.isBackOff);
      const baseSets = mainSets.length > 0 ? mainSets : realSets; // edge: tudo back-off

      // ── INTENSITY SCORE: qualidade das séries principais apenas ──
      const maxWeight = Math.max(...baseSets.map((s) => s.weight || 0));
      const avgReps   = baseSets.reduce((sum, s) => sum + (s.reps || 0), 0) / baseSets.length;
      // Completion: back-off conta como série feita — você ainda treinou o músculo
      const completionRate = realSets.length / totalSets;

      const weightScore     = (maxWeight / pr) - 1;           // peso máx vs PR
      const repsScore       = (avgReps / programmedReps) - 1; // avg reps vs mínimo do range
      const completionScore = completionRate - 1;              // séries totais vs programado

      const intensityScore = weightScore * 0.6 + repsScore * 0.3 + completionScore * 0.1;

      // ── VOLUME SCORE: carga total da sessão (main + back-off) ──
      // Back-off com reps altas até a falha gera VL real → crédito de volume legítimo
      const actualVL   = realSets.reduce((sum, s) => sum + (s.weight || 0) * (s.reps || 0), 0);
      const baselineVL = pr * programmedReps * totalSets;
      const volumeScore = baselineVL > 0 ? (actualVL / baselineVL) - 1 : 0;

      // 65% intensidade (força/qualidade) + 35% volume (trabalho total)
      return (intensityScore * 0.65 + volumeScore * 0.35) * 100;
    }

    // Fallback sem setsData detalhado
    if (entry.weight > 0) return ((entry.weight / pr) - 1) * 100;
    return null;
  }

  function formatDuration(secs) {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    if (h > 0 && m > 0) return `${h}h ${m}min`;
    if (h > 0) return `${h}h`;
    return `${m} min`;
  }

  // Always sync stateRef so drag handler (useEffect, no deps) reads fresh values
  stateRef.current = { isCustomWorkout, session, overrideExercises, routine, TODAY_OVERRIDE_KEY };

  const bg = PAGE_BG;

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh" sx={{ background: bg }}>
        <CircularProgress color="primary" />
      </Box>
    );
  }

  const exercises   = isCustomWorkout
    ? (session?.entries?.map((e) => ({ id: e.id, machineId: e.machineId, machine: e.machine, sets: e.sets || 3, reps: e.reps || 12 })) || [])
    : (overrideExercises ?? routine?.exercises ?? []);
  const loggedCount = isCustomWorkout ? exercises.length : exercises.filter((ex) => isLogged(ex.machine.id)).length;
  const prsHoje     = session?.entries?.filter((e) => e.hitPR).length || 0;

  // (no early return — "Vamos iniciar" is rendered inside the main return so dialogs work)


  return (
    <Box sx={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden", background: bg }}>
      <Container maxWidth="sm" sx={{ px: 2, display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>

        {/* Offline banner */}
      {showOfflineBanner && (
        <Box sx={{ mt: 2, borderRadius: 2.5, overflow: "hidden",
          bgcolor: "rgba(250,204,21,0.05)", border: "1px solid rgba(250,204,21,0.18)" }}>
          <Stack direction="row" alignItems="flex-start" spacing={1.5} sx={{ p: 2 }}>
            <WifiOffIcon sx={{ fontSize: 19, color: "#facc15", flexShrink: 0, mt: 0.15 }} />
            <Box>
              <Typography variant="caption" color="#facc15" fontWeight={800} display="block" mb={0.4}>
                Você está offline
              </Typography>
              <Typography variant="caption" color="rgba(255,255,255,0.4)" display="block" lineHeight={1.55}>
                A sincronização será feita ao reconectar ou ao abrir o app com internet.
              </Typography>
            </Box>
          </Stack>
          {/* progress bar */}
          <Box sx={{ height: "2px", bgcolor: "rgba(250,204,21,0.12)" }}>
            <Box
              onAnimationEnd={() => setShowOfflineBanner(false)}
              sx={{
                height: "100%", bgcolor: "#facc15",
                transformOrigin: "left center",
                animation: "offlineFill 6s linear forwards",
                "@keyframes offlineFill": {
                  from: { transform: "scaleX(0)" },
                  to:   { transform: "scaleX(1)" },
                },
              }}
            />
          </Box>
        </Box>
      )}

      {/* Header */}
        <Box sx={{ pt: 2, pb: 2 }}>
          <Stack direction="row" alignItems="flex-start" justifyContent="space-between">
            <Stack direction="row" alignItems="flex-start" spacing={0} sx={{ flex: 1 }}>
              <Box>
              <Typography variant="body2" color="text.secondary">
                {DAYS[dow]}{routine?.label ? ` · ${routine.label}` : " · treino de hoje"}
              </Typography>
              <Typography variant="h6" fontWeight={900} lineHeight={1.2}>
                {session?.finished && exercises.length > 0 ? "Treino finalizado" : exercises.length === 0 && !isCustomWorkout ? "Dia de descanso" : !session ? "Treino" : isCustomWorkout && exercises.length === 0 ? "Treino personalizado" : `${loggedCount}/${exercises.length} exercícios`}
              </Typography>
            </Box>
            </Stack>
            {session?.finished && exercises.length > 0 ? (
              <Chip label="Finalizado ✓" size="small"
                sx={{ bgcolor: "rgba(34,197,94,0.15)", color: "#22c55e", fontWeight: 700, mt: 0.5 }} />
            ) : (
              <Stack direction="row" alignItems="center" spacing={0} sx={{ mt: 0.5 }}>
                {/* Histórico sempre visível, some no modo edição */}
                {!editingToday && (
                  <IconButton onClick={openHistory} sx={{ color: "rgba(255,255,255,0.45)" }}>
                    <HistoryIcon />
                  </IconButton>
                )}
                {/* Recomeçar treino — visível quando há sessão ativa */}
                {exercises.length > 0 && !session?.finished && !editingToday && session && (
                  <Box onClick={() => setConfirmResetSessionOpen(true)}
                    sx={{ display: "flex", alignItems: "center", gap: 0.4, px: 1.2, py: 0.5, borderRadius: 1.5,
                      cursor: "pointer", "&:active": { opacity: 0.7 } }}>
                    <ReplayIcon sx={{ fontSize: 14, color: "rgba(255,255,255,0.3)" }} />
                    <Typography fontSize="0.7rem" color="rgba(255,255,255,0.3)" fontWeight={700}>
                      Recomeçar
                    </Typography>
                  </Box>
                )}
                {!session?.finished && exercises.length > 0 && (
                  <>
                    {editingToday && (
                      <IconButton onClick={restoreTodayRoutine} sx={{ color: "rgba(255,255,255,0.4)" }}>
                        <UndoIcon />
                      </IconButton>
                    )}
                    <IconButton
                      onClick={editingToday ? () => setEditingToday(false) : startEditingToday}
                      sx={{ color: editingToday ? "#22c55e" : "rgba(255,255,255,0.4)" }}>
                      <EditIcon />
                    </IconButton>
                  </>
                )}
              </Stack>
            )}
          </Stack>
          {session && !session.finished && exercises.length > 0 && (
            <Box sx={{ mt: 1.5, height: 4, borderRadius: 2, bgcolor: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
              <Box sx={{ height: "100%", width: `${(loggedCount / exercises.length) * 100}%`,
                bgcolor: "#22c55e", borderRadius: 2, transition: "width 0.4s ease" }} />
            </Box>
          )}
        </Box>

        {/* ── Treino finalizado ── */}
        {session?.finished && exercises.length > 0 ? (
          <Box sx={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", textAlign: "center", pb: 4 }}>
            <Box sx={{ fontSize: "3.5rem", mb: 2, lineHeight: 1 }}>💪</Box>
            <Typography fontWeight={900} fontSize="1.5rem" color="#22c55e" mb={0.5}>
              Parabéns, guerreiro!
            </Typography>
            <Typography color="text.secondary" fontSize="0.9rem" mb={session.duration > 0 ? 0.5 : prsHoje > 0 ? 1.5 : 2.5} maxWidth={280}>
              {congratsMsg}
            </Typography>
            {session.duration > 0 && (
              <Typography fontSize="0.82rem" color="rgba(255,255,255,0.45)" fontWeight={600}
                mb={prsHoje > 0 ? 1.5 : 2.5}>
                Treino concluído em {formatDuration(session.duration)}
              </Typography>
            )}
            {prsHoje > 0 && (
              <Chip
                icon={<EmojiEventsIcon sx={{ color: "#facc15 !important" }} />}
                label={`${prsHoje} PR${prsHoje > 1 ? "s" : ""} batido${prsHoje > 1 ? "s" : ""} hoje!`}
                sx={{ mb: 2.5, bgcolor: "rgba(250,204,21,0.12)", color: "#facc15",
                  fontWeight: 700, border: "1px solid rgba(250,204,21,0.25)" }}
              />
            )}
            <Button variant="outlined" startIcon={<HistoryIcon />} onClick={(e) => { openHistory(); }}
              sx={{ borderColor: "rgba(255,255,255,0.18)", color: "rgba(255,255,255,0.75)",
                fontWeight: 700, px: 3 }}>
              Ver histórico
            </Button>
            <Button variant="outlined" startIcon={<ReplayIcon />} onClick={() => setConfirmRedoWorkout(true)}
              sx={{ mt: 1.5, borderColor: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.5)",
                fontWeight: 700, px: 3 }}>
              Refazer treino
            </Button>
          </Box>
        ) : exercises.length === 0 && !isCustomWorkout ? (
          <Box sx={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", textAlign: "center", pb: 4 }}>
            <Box sx={{ fontSize: "3.5rem", mb: 2, lineHeight: 1 }}>😴</Box>
            <Typography fontWeight={900} fontSize="1.5rem" color="rgba(255,255,255,0.7)" mb={0.5}>
              Dia de descanso, guerreiro!
            </Typography>
            <Typography color="text.secondary" fontSize="0.9rem" mb={2.5} maxWidth={260}>
              Recuperação também é treino. Aproveita.
            </Typography>
            <Button variant="outlined" startIcon={<HistoryIcon />} onClick={(e) => { openHistory(); }}
              sx={{ borderColor: "rgba(255,255,255,0.18)", color: "rgba(255,255,255,0.75)",
                fontWeight: 700, px: 3 }}>
              Ver histórico
            </Button>
            <Button variant="outlined" startIcon={<FitnessCenterIcon />} onClick={startCustomSession}
              disabled={startingSession}
              sx={{ mt: 1.5, borderColor: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.5)",
                fontWeight: 700, px: 3 }}>
              {startingSession ? <CircularProgress size={18} /> : "Treino personalizado"}
            </Button>
          </Box>
        ) : isCustomWorkout && exercises.length === 0 ? (
          /* ── Treino personalizado vazio ── */
          <Box sx={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", textAlign: "center", pb: 8, gap: 0 }}>
            <FitnessCenterIcon sx={{ fontSize: 52, color: "rgba(255,255,255,0.1)", mb: 2 }} />
            <Typography color="text.secondary" fontSize="0.9rem" mb={3}>
              Adicione o primeiro exercício para começar.
            </Typography>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAddCustomOpen(true)}
              sx={{ py: 1.3, px: 4, fontWeight: 800, fontSize: "0.95rem", borderRadius: 2.5, mb: 1.5 }}>
              Adicionar exercício
            </Button>
            <Button variant="outlined" onClick={cancelCustomWorkout}
              sx={{ py: 1.1, px: 4, fontWeight: 700, fontSize: "0.88rem", borderRadius: 2.5,
                borderColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.6)",
                "&:hover": { borderColor: "rgba(255,255,255,0.3)", bgcolor: "rgba(255,255,255,0.04)" } }}>
              Voltar
            </Button>
          </Box>
        ) : (
          /* ── Lista de exercícios (scroll só aqui) ── */
          <Box ref={listRef} sx={{ flex: 1, overflowY: "auto", pb: 18 }}>
            {/* Banner "Começar treino" — aparece quando ainda não iniciou a sessão */}
            {!session && !editingToday && (
              <Box sx={{ mb: 2, p: 2, borderRadius: 3, bgcolor: "rgba(34,197,94,0.07)",
                border: "1px solid rgba(34,197,94,0.2)", textAlign: "center" }}>
                <Typography fontSize="0.8rem" color="rgba(255,255,255,0.45)" mb={1.5}>
                  O cronômetro começa ao iniciar o treino
                </Typography>
                <Button variant="contained" fullWidth disabled={startingSession}
                  onClick={() => { if (!startingSession) startSession(); }}
                  sx={{ py: 1.4, fontWeight: 900, fontSize: "1rem", borderRadius: 2.5,
                    background: "linear-gradient(135deg, #22c55e, #16a34a)",
                    boxShadow: "0 4px 20px rgba(34,197,94,0.35)" }}>
                  {startingSession ? <CircularProgress size={20} sx={{ color: "#000" }} /> : "▶ Começar treino"}
                </Button>
              </Box>
            )}
            {isCustomWorkout && (
              <Button startIcon={<AddIcon />} fullWidth variant="outlined"
                onClick={() => setAddCustomOpen(true)}
                sx={{ mb: 1.5, py: 1.2, borderRadius: 2.5, fontWeight: 700,
                  borderColor: "rgba(34,197,94,0.35)", color: "#22c55e",
                  "&:hover": { borderColor: "#22c55e", bgcolor: "rgba(34,197,94,0.06)" } }}>
                Adicionar exercício
              </Button>
            )}
            <Stack spacing={1.5}>
              {exercises.map((ex, exIdx) => {
                const logged   = isLogged(ex.machine.id);
                const partial  = isPartial(ex);
                const entry    = getEntry(ex.machine.id);
                const catColor = CATEGORY_COLOR[ex.machine.category] || "#aaa";
                const prev     = prevWorkout[ex.machine.id];
                const isExpanded = expandedExId === ex.machine.id;
                const isDragging = draggingIdx === exIdx;
                const dragShift  = (() => {
                  if (draggingIdx < 0 || isDragging) return 0;
                  if (draggingIdx < dropTargetIdx && exIdx > draggingIdx && exIdx <= dropTargetIdx) return -ITEM_H;
                  if (draggingIdx > dropTargetIdx && exIdx >= dropTargetIdx && exIdx < draggingIdx) return ITEM_H;
                  return 0;
                })();
                return (
                  <Box key={ex.id} sx={{
                    borderRadius: 3, overflow: "hidden",
                    border: logged && !partial ? "1px solid rgba(34,197,94,0.3)" : partial ? "1px solid rgba(217,119,6,0.3)" : "1px solid rgba(255,255,255,0.08)",
                    background: logged && !partial
                      ? "linear-gradient(135deg, rgba(34,197,94,0.09), rgba(34,197,94,0.02))"
                      : partial ? "rgba(217,119,6,0.04)"
                      : "rgba(255,255,255,0.04)",
                    ...(editingToday && {
                      transform: isDragging
                        ? `translateY(${dragOffsetY}px) scale(1.03)`
                        : dragShift !== 0 ? `translateY(${dragShift}px)` : "none",
                      transition: isDragging ? "none" : "transform 0.12s cubic-bezier(0.2,0,0,1)",
                      willChange: isDragging ? "transform" : "auto",
                      zIndex: isDragging ? 100 : 1,
                      boxShadow: isDragging ? "0 14px 44px rgba(0,0,0,0.65)" : "none",
                      position: "relative",
                    }),
                  }}>
                    <Box sx={{ px: 2.5, py: 2.2, display: "flex", alignItems: "center", gap: 2 }}>
                      {/* Drag handle — only in edit mode */}
                      {editingToday && (
                        <Box onPointerDown={(e) => onDragHandleDown(e, exIdx)}
                          sx={{ flexShrink: 0, color: "rgba(255,255,255,0.3)", cursor: "grab",
                            touchAction: "none", display: "flex", alignItems: "center" }}>
                          <DragIndicatorIcon />
                        </Box>
                      )}
                      {/* Clickable thumbnail */}
                      <Box onClick={() => setPhotoPreview(ex)} sx={{ flexShrink: 0, cursor: "pointer" }}>
                        <ExerciseThumbnail machine={ex.machine} size={92} />
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Stack direction="row" alignItems="center" spacing={0.6} mb={0.5}>
                          <Typography fontWeight={800} fontSize="1.08rem" lineHeight={1.2}>{ex.machine.name}</Typography>
                          {entry?.hitPR && <EmojiEventsIcon sx={{ fontSize: 16, color: "#facc15", flexShrink: 0 }} />}
                        </Stack>
                        <Chip label={ex.machine.category} size="small" sx={{
                          height: 20, fontSize: "0.65rem", fontWeight: 700,
                          bgcolor: `${catColor}18`, color: catColor, border: `1px solid ${catColor}33`,
                        }} />
                        {entry && !partial && (() => {
                          if (!entry.weight) return (
                            <Typography sx={{ display: "block", color: "rgba(255,255,255,0.35)", fontWeight: 700, mt: 0.6, fontSize: "0.85rem" }}>
                              Não realizado
                            </Typography>
                          );
                          const evo = calcEvolution(entry, ex);
                          if (evo === null) return null;
                          const color = evo > 0.5 ? "#22c55e" : evo < -0.5 ? "#ef4444" : "#facc15";
                          const Icon  = evo > 0.5 ? TrendingUpIcon : evo < -0.5 ? TrendingDownIcon : RemoveIcon;
                          const sign  = evo > 0.5 ? "+" : "";
                          return (
                            <Stack direction="row" alignItems="center" spacing={0.4} mt={0.6}>
                              <Typography sx={{ color: "rgba(255,255,255,0.4)", fontSize: "0.78rem", fontWeight: 500 }}>
                                Evolução
                              </Typography>
                              <Typography sx={{ color, fontWeight: 800, fontSize: "0.85rem" }}>
                                {sign}{evo.toFixed(1)}%
                              </Typography>
                              <Icon sx={{ fontSize: 14, color }} />
                            </Stack>
                          );
                        })()}
                      </Box>
                      {editingToday ? (
                        <Stack direction="row" spacing={0} sx={{ flexShrink: 0 }}>
                          <IconButton onClick={() => openExerciseInfo(ex)} sx={{ color: "rgba(255,255,255,0.4)" }}>
                            <EditIcon />
                          </IconButton>
                          <IconButton onClick={() => setConfirmDeleteMachineId(ex.machine.id)} sx={{ color: "#ef4444" }}>
                            <DeleteIcon />
                          </IconButton>
                        </Stack>
                      ) : partial ? (
                        <Button variant="contained" onClick={(e) => { continueLog(ex); }}
                          sx={{ flexShrink: 0, px: 2.5, py: 1.3, fontSize: "0.88rem", fontWeight: 800, borderRadius: 2.5,
                            bgcolor: "#d97706", "&:hover": { bgcolor: "#b45309" } }}>
                          Continuar
                        </Button>
                      ) : !logged ? (
                        <Button variant="contained"
                          disabled={!!pendingLogEx && !session}
                          onClick={(e) => {
                            if (!session) {
                              setPendingLogEx(ex);
                              if (!startingSession) startSession();
                              return;
                            }
                            openLog(ex);
                          }}
                          sx={{ flexShrink: 0, px: 3, py: 1.3, fontSize: "0.88rem", fontWeight: 800, borderRadius: 2.5 }}>
                          {pendingLogEx?.machine.id === ex.machine.id && !session ? <CircularProgress size={16} sx={{ color: "#000" }} /> : "Anotar"}
                        </Button>
                      ) : (
                        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ flexShrink: 0 }}>
                          <CheckIcon sx={{ color: "#22c55e", fontSize: 26 }} />
                          <IconButton size="small" onClick={(e) => { openEditMode(ex); }}
                            sx={{ color: "rgba(255,255,255,0.35)", "&:hover": { color: "rgba(255,255,255,0.7)" } }}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Stack>
                      )}
                    </Box>
                    {/* Info bar: sempre visível */}
                    {(
                      <Box sx={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                        <Box onClick={() => setExpandedExId(isExpanded ? null : ex.machine.id)}
                          sx={{ px: 2.5, py: 0.8, display: "flex", alignItems: "center", justifyContent: "space-between",
                            cursor: "pointer", "&:active": { opacity: 0.7 } }}>
                          {/* Colapsado: apenas PR */}
                          {!isExpanded && (
                            <Stack direction="row" alignItems="center" spacing={0.4}>
                              <EmojiEventsIcon sx={{ fontSize: 13, color: ex.machine.currentPR != null ? "#facc15" : "rgba(255,255,255,0.3)" }} />
                              <Typography fontSize="0.75rem" color={ex.machine.currentPR != null ? "#facc15" : "rgba(255,255,255,0.3)"} fontWeight={700}>
                                {ex.machine.currentPR != null ? `PR: ${ex.machine.currentPR}kg` : "PR: ?"}
                              </Typography>
                            </Stack>
                          )}
                          {isExpanded && <Box />}
                          {isExpanded ? <ExpandLessIcon sx={{ fontSize: 16, color: "rgba(255,255,255,0.25)", flexShrink: 0 }} />
                            : <ExpandMoreIcon sx={{ fontSize: 16, color: "rgba(255,255,255,0.25)", flexShrink: 0 }} />}
                        </Box>
                        {isExpanded && (
                          <Box sx={{ px: 2.5, pb: 1.5, display: "flex", flexDirection: "column", gap: 0.8 }}>
                            <Stack direction="row" spacing={2}>
                              <Box>
                                <Typography fontSize="0.65rem" color="rgba(255,255,255,0.3)" fontWeight={600} textTransform="uppercase" letterSpacing={0.5}>Séries</Typography>
                                <Typography fontSize="0.82rem" color="rgba(255,255,255,0.7)" fontWeight={700}>
                                  {ex.sets}×{ex.repsMax ? `${ex.reps}-${ex.repsMax}` : ex.reps}
                                </Typography>
                              </Box>
                              <Box>
                                <Typography fontSize="0.65rem" color="rgba(255,255,255,0.3)" fontWeight={600} textTransform="uppercase" letterSpacing={0.5}>PR atual</Typography>
                                <Stack direction="row" alignItems="center" spacing={0.3}>
                                  <EmojiEventsIcon sx={{ fontSize: 13, color: ex.machine.currentPR != null ? "#facc15" : "rgba(255,255,255,0.3)" }} />
                                  <Typography fontSize="0.82rem" color={ex.machine.currentPR != null ? "#facc15" : "rgba(255,255,255,0.3)"} fontWeight={700}>
                                    {ex.machine.currentPR != null ? `${ex.machine.currentPR}kg` : "?"}
                                  </Typography>
                                </Stack>
                              </Box>
                            </Stack>
                            {prev && (() => {
                              let sd = prev.setsData;
                              if (typeof sd === "string") { try { sd = JSON.parse(sd); } catch { sd = null; } }
                              return (
                                <Box sx={{ mt: 0.3 }}>
                                  <Typography fontSize="0.65rem" color="rgba(255,255,255,0.3)" fontWeight={600} textTransform="uppercase" letterSpacing={0.5} mb={0.3}>
                                    Último treino
                                  </Typography>
                                  {Array.isArray(sd) ? sd.filter((s) => !s.skipped).map((s, i) => (
                                    <Stack key={i} direction="row" alignItems="center" spacing={0.5}>
                                      <Typography fontSize="0.72rem" color="rgba(255,255,255,0.25)" fontWeight={600} sx={{ minWidth: 42 }}>
                                        Série {i + 1}
                                      </Typography>
                                      <Typography fontSize="0.75rem" color="rgba(255,255,255,0.5)" fontWeight={600}>
                                        {(s.weight ?? prev.weight) != null ? `${s.weight ?? prev.weight}kg` : "—"} × {s.reps}{s.isBackOff ? " · back-off" : ""}
                                      </Typography>
                                    </Stack>
                                  )) : (
                                    <Typography fontSize="0.75rem" color="rgba(255,255,255,0.5)" fontWeight={600}>
                                      {prev.weight}kg × {prev.reps} reps
                                    </Typography>
                                  )}
                                  {prev.comment && (
                                    <Typography fontSize="0.7rem" color="rgba(255,255,255,0.25)" fontStyle="italic" mt={0.3}>
                                      "{prev.comment}"
                                    </Typography>
                                  )}
                                </Box>
                              );
                            })()}
                          </Box>
                        )}
                      </Box>
                    )}
                  </Box>
                );
              })}
            </Stack>
          </Box>
        )}
      </Container>

      {/* FABs flutuantes: + em modo edição, check para finalizar */}
      {exercises.length > 0 && !session?.finished && (
        <Box sx={{ position: "fixed", bottom: 110, right: 20, zIndex: 1300 }}>
          {editingToday ? (
            <Box onClick={() => setAddTodayOpen(true)}
              sx={{
                width: 52, height: 52, borderRadius: "50%",
                bgcolor: "#22c55e",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer",
                boxShadow: "0 4px 20px rgba(34,197,94,0.38), 0 2px 10px rgba(0,0,0,0.5)",
                transition: "transform 0.14s",
                "&:active": { transform: "scale(0.88)" },
              }}>
              <AddIcon sx={{ color: "#000", fontSize: 22 }} />
            </Box>
          ) : (
            <Box onClick={() => {
              if (!session) return; // aguarda início da sessão
              if (loggedCount === exercises.length) { setFinishDialog(true); }
              else { setConfirmIncompleteOpen(true); }
            }}
              sx={{
                width: 52, height: 52, borderRadius: "50%",
                bgcolor: !session ? "rgba(34,197,94,0.08)" : loggedCount === exercises.length ? "#22c55e" : "#1c3a2a",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: session ? "pointer" : "default",
                boxShadow: loggedCount === exercises.length && session
                  ? "0 4px 20px rgba(34,197,94,0.38), 0 2px 10px rgba(0,0,0,0.5)"
                  : "0 2px 10px rgba(0,0,0,0.5)",
                border: !session || loggedCount !== exercises.length ? "1.5px solid rgba(34,197,94,0.15)" : "none",
                transition: "transform 0.14s",
                "&:active": session ? { transform: "scale(0.88)" } : {},
              }}>
              <CheckIcon sx={{
                color: !session ? "rgba(34,197,94,0.25)" : loggedCount === exercises.length ? "#000" : "rgba(34,197,94,0.45)",
                fontSize: 22,
              }} />
            </Box>
          )}
        </Box>
      )}

      {/* Dialog: anotar */}
      <Dialog open={!!logEx} onClose={handleDialogClose} fullWidth maxWidth="xs"
        PaperProps={{ sx: { bgcolor: "#071a12", backgroundImage: "none", borderRadius: 2 } }}
        slotProps={{ backdrop: { sx: { bgcolor: "rgba(2,6,23,0.75)" } } }}>
        {logEx && (
          <Box sx={{ pb: 2 }}>
            <Box sx={{ px: 3, pt: 3, pb: 0, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Box>
                <Typography fontWeight={900} fontSize="1rem">{logEx.machine.name}</Typography>
                {weightUnit === "kg" && (() => {
                  const prev = prevWorkout[logEx.machine.id];
                  if (!prev) return null;
                  const curMax = Math.max(...simpleSets.map((s) => parseFloat(s.weight) || 0).filter((x) => x > 0), 0);
                  if (!curMax) return null;
                  const diff = Math.round((curMax - prev.weight) * 10) / 10;
                  if (diff === 0) return null;
                  return (
                    <Stack direction="row" alignItems="center" spacing={0.3} mt={0.3}>
                      {diff > 0 ? <TrendingUpIcon sx={{ fontSize: 14, color: "#22c55e" }} /> : <TrendingDownIcon sx={{ fontSize: 14, color: "#ef4444" }} />}
                      <Typography fontSize="0.72rem" color={diff > 0 ? "#22c55e" : "#ef4444"} fontWeight={700}>
                        {diff > 0 ? "+" : ""}{diff}kg vs último
                      </Typography>
                    </Stack>
                  );
                })()}
              </Box>
              <Stack direction="row" alignItems="center" spacing={1}>
                {/* Toggle kg / placas */}
                <Box onClick={() => {
                    const next = weightUnit === "kg" ? "placas" : "kg";
                    setWeightUnit(next);
                    localStorage.setItem(`dg_weight_unit_${logEx.machine.id}`, next);
                  }}
                  sx={{ display: "flex", alignItems: "center", gap: 0.5, px: 1.2, py: 0.5, borderRadius: 2,
                    bgcolor: weightUnit === "placas" ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.06)",
                    border: weightUnit === "placas" ? "1px solid rgba(34,197,94,0.4)" : "1px solid rgba(255,255,255,0.12)",
                    cursor: "pointer", "&:active": { transform: "scale(0.92)" } }}>
                  <ScaleIcon sx={{ fontSize: 14, color: weightUnit === "placas" ? "#22c55e" : "rgba(255,255,255,0.4)" }} />
                  <Typography fontSize="0.68rem" fontWeight={700}
                    color={weightUnit === "placas" ? "#22c55e" : "rgba(255,255,255,0.4)"}>
                    {weightUnit === "placas" ? "placas" : "kg"}
                  </Typography>
                </Box>
                <ExerciseThumbnail machine={logEx.machine} size={44} />
              </Stack>
            </Box>
            {weightUnit === "kg" && logEx.machine.currentPR != null && (
              <Box sx={{ px: 3, pt: 1 }}>
                <Stack direction="row" alignItems="center" spacing={0.4}>
                  <EmojiEventsIcon sx={{ fontSize: 13, color: "#facc15" }} />
                  <Typography fontSize="0.75rem" color="#facc15" fontWeight={700}>PR: {logEx.machine.currentPR}kg</Typography>
                </Stack>
              </Box>
            )}
            <Box sx={{ px: 2.5, pt: 2, pb: 0 }}>
              <Stack spacing={1.5}>
                {simpleSets.map((s, i) => (
                  <Box key={i}>
                    {/* Série label + delete */}
                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.8 }}>
                      <Typography fontSize="0.72rem" color="rgba(255,255,255,0.35)" fontWeight={700} letterSpacing="0.04em">
                        SÉRIE {i + 1}
                      </Typography>
                      {simpleSets.length > 1 && (
                        <IconButton size="small"
                          onClick={() => setSimpleSets((prev) => prev.filter((_, idx) => idx !== i))}
                          sx={{ color: "rgba(255,255,255,0.18)", p: 0.3 }}>
                          <CloseIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      )}
                    </Box>
                    {/* Spinners lado a lado */}
                    <Box sx={{ display: "flex", gap: 2 }}>
                      {/* Peso */}
                      <Box sx={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 0.4,
                        bgcolor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 2, py: 1 }}>
                        <IconButton size="small"
                          onClick={() => setSimpleSets((prev) => prev.map((ss, idx) => idx === i ? { ...ss, weight: (parseFloat(ss.weight) || 0) + 1 } : ss))}
                          sx={{ width: 32, height: 32, color: "rgba(255,255,255,0.55)" }}>
                          <AddIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                        <TextField type="number" size="small" value={s.weight}
                          onChange={(e) => setSimpleSets((prev) => prev.map((ss, idx) => idx === i ? { ...ss, weight: e.target.value } : ss))}
                          inputProps={{ min: 0, step: 1, style: { textAlign: "center", padding: "4px 2px", fontWeight: 800, fontSize: "1.1rem" } }}
                          sx={{ width: "100%", "& fieldset": { border: "none" } }} />
                        <Typography fontSize="0.7rem" color="rgba(255,255,255,0.35)" fontWeight={600} mt={-0.5}>{weightUnit}</Typography>
                        <IconButton size="small"
                          onClick={() => setSimpleSets((prev) => prev.map((ss, idx) => idx === i ? { ...ss, weight: Math.max(0.5, (parseFloat(ss.weight) || 0) - 1) } : ss))}
                          sx={{ width: 32, height: 32, color: "rgba(255,255,255,0.55)" }}>
                          <RemoveIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                      </Box>
                      {/* Reps */}
                      <Box sx={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 0.4,
                        bgcolor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 2, py: 1 }}>
                        <IconButton size="small"
                          onClick={() => setSimpleSets((prev) => prev.map((ss, idx) => idx === i ? { ...ss, reps: (ss.reps || 0) + 1 } : ss))}
                          sx={{ width: 32, height: 32, color: "rgba(255,255,255,0.55)" }}>
                          <AddIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                        <TextField type="number" size="small" value={s.reps}
                          onChange={(e) => setSimpleSets((prev) => prev.map((ss, idx) => idx === i ? { ...ss, reps: parseInt(e.target.value) || 0 } : ss))}
                          inputProps={{ min: 1, step: 1, style: { textAlign: "center", padding: "4px 2px", fontWeight: 800, fontSize: "1.1rem" } }}
                          sx={{ width: "100%", "& fieldset": { border: "none" } }} />
                        <Typography fontSize="0.7rem" color="rgba(255,255,255,0.35)" fontWeight={600} mt={-0.5}>rep</Typography>
                        <IconButton size="small"
                          onClick={() => setSimpleSets((prev) => prev.map((ss, idx) => idx === i ? { ...ss, reps: Math.max(1, (ss.reps || 0) - 1) } : ss))}
                          sx={{ width: 32, height: 32, color: "rgba(255,255,255,0.55)" }}>
                          <RemoveIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                      </Box>
                    </Box>
                  </Box>
                ))}
              </Stack>
              <Button size="small" startIcon={<AddIcon />}
                onClick={() => setSimpleSets((prev) => [...prev, { weight: prev[prev.length - 1]?.weight ?? "", reps: logEx.reps }])}
                sx={{ mt: 1, color: "rgba(255,255,255,0.38)", fontSize: "0.78rem", textTransform: "none" }}>
                Adicionar série
              </Button>
            </Box>
            <Box sx={{ px: 2.5, pt: 2, display: "flex", gap: 1.5 }}>
              <Button variant="outlined" fullWidth onClick={() => setLogEx(null)}
                sx={{ py: 1.2, fontWeight: 700, borderColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.6)" }}>
                Cancelar
              </Button>
              <Button variant="contained" fullWidth disabled={saving}
                onClick={() => commitEntry(simpleSets.map((s) => ({ weight: parseFloat(s.weight) || 0, reps: s.reps || 0, isBackOff: false, unit: weightUnit })), "")}
                sx={{ py: 1.2, fontWeight: 800 }}>
                {saving ? <CircularProgress size={18} /> : "Salvar"}
              </Button>
            </Box>
          </Box>
        )}
      </Dialog>

      <EditEntryDialog
        open={!!editEx}
        exercise={editEx}
        onClose={() => setEditEx(null)}
        onSave={handleEditSave}
        onRedo={handleEditRedo}
        saving={editSaving}
      />

      <FinishDialog
        open={finishDialog}
        onClose={() => setFinishDialog(false)}
        onFinish={finishSession}
        saving={saving}
      />

      {/* Dialog: treino incompleto */}
      <Dialog open={confirmIncompleteOpen} onClose={() => setConfirmIncompleteOpen(false)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { bgcolor: "#071a12", backgroundImage: "none", borderRadius: 2 } }}>
        <Box sx={{ px: 3, pt: 3, pb: 1 }}>
          <Typography fontWeight={900} fontSize="1rem">Finalizar assim?</Typography>
        </Box>
        <DialogContent>
          <Typography color="text.secondary" fontSize="0.9rem">
            Você tem {exercises.length - loggedCount} exercício{exercises.length - loggedCount !== 1 ? "s" : ""} não feito{exercises.length - loggedCount !== 1 ? "s" : ""}.
            Eles serão considerados não realizados.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setConfirmIncompleteOpen(false)}
            sx={{ fontWeight: 700, color: "rgba(255,255,255,0.5)" }}>Cancelar</Button>
          <Button variant="contained" onClick={() => { setConfirmIncompleteOpen(false); setFinishDialog(true); }}
            sx={{ fontWeight: 800 }}>Finalizar</Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: confirmar exclusão do exercício de hoje */}
      <Dialog open={!!confirmDeleteMachineId} onClose={() => setConfirmDeleteMachineId(null)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { bgcolor: "#071a12", backgroundImage: "none", borderRadius: 2 } }}>
        <Box sx={{ px: 3, pt: 3, pb: 1 }}>
          <Typography fontWeight={900} fontSize="1rem">Remover exercício?</Typography>
        </Box>
        <DialogContent>
          <Typography color="text.secondary" fontSize="0.9rem">
            Esse exercício será removido do treino de hoje. A rotina padrão não será afetada.
          </Typography>
        </DialogContent>
        <Box sx={{ px: 3, pb: 3, display: "flex", gap: 1.5 }}>
          <Button onClick={() => setConfirmDeleteMachineId(null)} sx={{ color: "rgba(255,255,255,0.5)" }}>
            Cancelar
          </Button>
          <Button variant="contained" fullWidth
            onClick={() => { removeTodayExercise(confirmDeleteMachineId); setConfirmDeleteMachineId(null); }}
            sx={{ bgcolor: "#ef4444", "&:hover": { bgcolor: "#dc2626" } }}>
            Remover
          </Button>
        </Box>
      </Dialog>

      {/* Fix 1+5: confirmação ao voltar */}
      <Dialog open={confirmBackOpen} onClose={() => setConfirmBackOpen(false)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { bgcolor: "#071a12", backgroundImage: "none", borderRadius: 2 } }}>
        <Box sx={{ px: 3, pt: 3, pb: 3 }}>
          <Typography fontWeight={900} fontSize="1rem" mb={1}>Sair do treino?</Typography>
          <Typography color="text.secondary" fontSize="0.88rem" mb={3}>
            Seu progresso será mantido. Você pode continuar depois.
          </Typography>
          <Stack spacing={1}>
            <Button variant="contained" fullWidth onClick={handleBackConfirmExit}
              sx={{ py: 1.3, fontWeight: 800 }}>
              Sair e manter progresso
            </Button>
            <Button variant="outlined" fullWidth onClick={doDeleteSession}
              sx={{ py: 1.2, fontWeight: 700, borderColor: "rgba(239,68,68,0.3)", color: "rgba(239,68,68,0.7)",
                "&:hover": { borderColor: "rgba(239,68,68,0.6)", bgcolor: "rgba(239,68,68,0.05)" } }}>
              Cancelar treino
            </Button>
            <Button variant="outlined" fullWidth onClick={() => setConfirmBackOpen(false)}
              sx={{ py: 1.2, fontWeight: 700, borderColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.6)" }}>
              Continuar treinando
            </Button>
          </Stack>
        </Box>
      </Dialog>

      {/* Dialog: recomeçar treino */}
      <Dialog open={confirmResetSessionOpen} onClose={() => setConfirmResetSessionOpen(false)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { bgcolor: "#071a12", backgroundImage: "none", borderRadius: 2 } }}>
        <Box sx={{ px: 3, pt: 3, pb: 3 }}>
          <Typography fontWeight={900} fontSize="1rem" mb={1}>Recomeçar treino?</Typography>
          <Typography color="text.secondary" fontSize="0.88rem" mb={3}>
            O progresso atual será apagado e você começará do zero.
          </Typography>
          <Stack spacing={1}>
            <Button variant="contained" fullWidth
              onClick={() => { setConfirmResetSessionOpen(false); doDeleteSession(); }}
              sx={{ py: 1.3, fontWeight: 800 }}>
              Recomeçar do zero
            </Button>
            <Button variant="outlined" fullWidth onClick={() => setConfirmResetSessionOpen(false)}
              sx={{ py: 1.2, fontWeight: 700, borderColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.6)" }}>
              Cancelar
            </Button>
          </Stack>
        </Box>
      </Dialog>

      {/* Dialog: confirmar refazer treino */}
      <Dialog open={confirmRedoWorkout} onClose={() => setConfirmRedoWorkout(false)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { bgcolor: "#071a12", backgroundImage: "none", borderRadius: 2 } }}>
        <Box sx={{ px: 3, pt: 3, pb: 3 }}>
          <Typography fontWeight={900} fontSize="1rem" mb={1}>Refazer treino?</Typography>
          <Typography color="text.secondary" fontSize="0.88rem" mb={3}>
            O treino finalizado será apagado e você começará do zero com os mesmos exercícios.
          </Typography>
          <Stack spacing={1}>
            <Button variant="contained" fullWidth onClick={redoWorkout}
              sx={{ py: 1.3, fontWeight: 800 }}>
              Sim, refazer
            </Button>
            <Button variant="outlined" fullWidth onClick={() => setConfirmRedoWorkout(false)}
              sx={{ py: 1.2, fontWeight: 700, borderColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.6)" }}>
              Cancelar
            </Button>
          </Stack>
        </Box>
      </Dialog>

      {/* Fix 11: Dialog adicionar exercício com busca/filtro/criar */}
      <Dialog open={addTodayOpen || addCustomOpen}
        onClose={() => { setAddTodayOpen(false); setAddCustomOpen(false); setAddSearch(""); setAddFilter("Todos"); }}
        fullWidth maxWidth="sm"
        PaperProps={{ sx: { bgcolor: "#071a12", backgroundImage: "none", borderRadius: 2 } }}>
        <Box sx={{ px: 2.5, pt: 2.5, pb: 1, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Typography fontWeight={900} fontSize="1rem">{addCustomOpen ? "Adicionar exercício" : "Adicionar hoje"}</Typography>
          <IconButton size="small" onClick={() => { setAddTodayOpen(false); setAddCustomOpen(false); setAddSearch(""); setAddFilter("Todos"); }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
        {/* Search */}
        <Box sx={{ px: 2, mb: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 1.5, py: 0.8, borderRadius: 2.5,
            bgcolor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)",
            "&:focus-within": { border: "1px solid rgba(34,197,94,0.35)" } }}>
            <SearchIcon sx={{ fontSize: 18, color: "rgba(255,255,255,0.3)" }} />
            <InputBase placeholder="Pesquisar..." value={addSearch} onChange={(e) => setAddSearch(e.target.value)}
              fullWidth sx={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.85)" }} />
          </Box>
        </Box>
        {/* Category filter */}
        <Box data-no-swipe sx={{ px: 2, pb: 1, display: "flex", flexWrap: "wrap", gap: 0.5 }}>
          {["Todos", ...new Set(todayMachines.map((m) => m.category))].map((c) => (
            <Chip key={c} label={c} size="small" clickable onClick={() => setAddFilter(c)}
              sx={{ fontSize: "0.72rem", height: 26,
                bgcolor: addFilter === c ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.06)",
                color: addFilter === c ? "#22c55e" : "rgba(255,255,255,0.6)",
                border: addFilter === c ? "1px solid rgba(34,197,94,0.3)" : "1px solid transparent" }} />
          ))}
        </Box>
        <Box sx={{ px: 2, pb: 2, overflowY: "auto", maxHeight: "50vh", position: "relative" }}>
          <Stack spacing={0.8} sx={{ pb: 7 }}>
            {todayMachines
              .filter((m) => addFilter === "Todos" || m.category === addFilter)
              .filter((m) => !addSearch || m.name.toLowerCase().includes(addSearch.toLowerCase()))
              .map((m) => (
              <Box key={m.id} onClick={() => { addCustomOpen ? addCustomExercise(m) : addTodayExercise(m); setAddSearch(""); setAddFilter("Todos"); }}
                sx={{
                  display: "flex", alignItems: "center", gap: 1.5,
                  p: 1.2, borderRadius: 2.5, cursor: "pointer",
                  bgcolor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)",
                  "&:active": { opacity: 0.7 }, "&:hover": { bgcolor: "rgba(255,255,255,0.07)" },
                }}>
                <ExerciseThumbnail machine={m} size={46} />
                <Box sx={{ flex: 1 }}>
                  <Typography fontWeight={700} fontSize="0.9rem">{m.name}</Typography>
                  <Typography variant="caption" color="text.secondary">{m.category}</Typography>
                </Box>
                <ChevronRightIcon sx={{ color: "rgba(255,255,255,0.2)", fontSize: 16 }} />
              </Box>
            ))}
          </Stack>
          {/* FAB: criar novo exercício */}
          <Box sx={{ position: "sticky", bottom: 8, display: "flex", justifyContent: "center", pt: 1 }}>
            <Box onClick={() => setAddNewOpen(true)}
              sx={{
                display: "flex", alignItems: "center", gap: 0.8,
                px: 2.5, py: 1.2, borderRadius: 50, cursor: "pointer",
                bgcolor: "#22c55e", boxShadow: "0 4px 16px rgba(34,197,94,0.4), 0 2px 8px rgba(0,0,0,0.4)",
                transition: "transform 0.12s", "&:active": { transform: "scale(0.94)" },
              }}>
              <AddIcon sx={{ color: "#000", fontSize: 20 }} />
              <Typography fontWeight={800} fontSize="0.82rem" color="#000">Criar novo</Typography>
            </Box>
          </Box>
        </Box>
      </Dialog>

      {/* Fix 11: Dialog criar novo exercício */}
      <Dialog open={addNewOpen} onClose={() => setAddNewOpen(false)} fullWidth maxWidth="xs"
        PaperProps={{ sx: { bgcolor: "#071a12", backgroundImage: "none", borderRadius: 2 } }}>
        <DialogTitle sx={{ fontWeight: 900 }}>Novo exercício</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={0.5}>
            <TextField label="Nome do exercício" value={newExName} onChange={(e) => setNewExName(e.target.value)}
              fullWidth size="small" autoFocus />
            <TextField select label="Categoria" value={newExCategory} onChange={(e) => setNewExCategory(e.target.value)}
              fullWidth size="small" SelectProps={{ MenuProps: { PaperProps: { sx: { maxHeight: 240 } } } }}>
              {CATEGORIES.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setAddNewOpen(false)} sx={{ color: "rgba(255,255,255,0.5)" }}>Cancelar</Button>
          <Button variant="contained" onClick={handleCreateNewExercise}
            disabled={!newExName.trim() || !newExCategory}>Criar</Button>
        </DialogActions>
      </Dialog>

      {/* Dialog editar info do exercício — sem foto, com séries/reps */}
      <Dialog open={!!editInfoEx} onClose={() => setEditInfoEx(null)} fullWidth maxWidth="xs"
        PaperProps={{ sx: { bgcolor: "#071a12", backgroundImage: "none", borderRadius: 2 } }}>
        {editInfoEx && (
          <Box sx={{ pb: 2 }}>
            <Box sx={{ px: 3, pt: 3, pb: 1.5, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Typography fontWeight={900} fontSize="1rem">Editar exercício</Typography>
              <IconButton size="small" onClick={() => setEditInfoEx(null)} sx={{ color: "rgba(255,255,255,0.4)" }}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>
            <Stack spacing={2} px={2.5}>
              <TextField label="Nome" value={editInfoName} onChange={(e) => setEditInfoName(e.target.value)}
                fullWidth size="small" />
              <TextField label="PR atual (kg)" type="number" value={editInfoPR}
                onChange={(e) => setEditInfoPR(e.target.value)}
                fullWidth size="small" inputProps={{ min: 0, step: 2.5 }} />
              <Stack direction="row" spacing={1.5}>
                <TextField label="Séries" type="number" value={editInfoSets}
                  onChange={(e) => setEditInfoSets(e.target.value)}
                  fullWidth size="small" inputProps={{ min: 1, step: 1 }} />
                <TextField label="Reps" value={editInfoReps}
                  onChange={(e) => setEditInfoReps(e.target.value)}
                  fullWidth size="small" placeholder="12 ou 6-9" />
              </Stack>
            </Stack>
            <Box sx={{ px: 2.5, mt: 2, display: "flex", flexDirection: "column", gap: 1 }}>
              <Button variant="contained" fullWidth onClick={saveExerciseInfo} disabled={editInfoSaving}
                sx={{ py: 1.3, fontWeight: 800, borderRadius: 2.5 }}>
                {editInfoSaving ? <CircularProgress size={18} /> : "Salvar"}
              </Button>
              <Button variant="outlined" fullWidth onClick={() => setEditInfoEx(null)}
                sx={{ py: 1.1, fontWeight: 700, borderRadius: 2.5,
                  borderColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.6)" }}>
                Cancelar
              </Button>
            </Box>
          </Box>
        )}
      </Dialog>

      {/* Photo preview — visualiza + clique na foto troca a foto */}
      <Dialog open={!!photoPreview} onClose={() => setPhotoPreview(null)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { bgcolor: "#071a12", backgroundImage: "none", borderRadius: 2, overflow: "hidden" } }}>
        {photoPreview && (
          <Box>
            <Box onClick={() => photoPreviewFileRef.current?.click()}
              sx={{ cursor: "pointer", "&:active": { opacity: 0.85 }, position: "relative",
                width: "100%", aspectRatio: "1/1", overflow: "hidden", bgcolor: "rgba(255,255,255,0.04)" }}>
              {photoPreview.machine.photoBase64 ? (
                <Box component="img" src={photoPreview.machine.photoBase64}
                  sx={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              ) : (
                <Box sx={{ width: "100%", height: "100%", display: "flex", alignItems: "center",
                  justifyContent: "center",
                  background: CATEGORY_GRADIENT[photoPreview.machine.category] || "linear-gradient(135deg,#1e293b,#0f172a)" }}>
                  <FitnessCenterIcon sx={{ fontSize: 64, color: "rgba(255,255,255,0.15)" }} />
                </Box>
              )}
              <Box sx={{ position: "absolute", bottom: 8, right: 8, bgcolor: "rgba(0,0,0,0.55)",
                borderRadius: "50%", width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <PhotoCameraIcon sx={{ fontSize: 18, color: "#fff" }} />
              </Box>
            </Box>
            <Box sx={{ px: 2.5, py: 1.5, textAlign: "center" }}>
              <Typography fontWeight={800} fontSize="1rem">{photoPreview.machine.name}</Typography>
            </Box>
            <input ref={photoPreviewFileRef} type="file" accept="image/*" capture="environment" hidden
              onChange={async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = async (ev) => {
                  const base64 = await compressImage(ev.target.result);
                  const machineId = photoPreview.machine.id;
                  try { await api.patch(`/machines/${machineId}`, { photoBase64: base64 }); } catch {}
                  const updatedMachine = { ...photoPreview.machine, photoBase64: base64 };
                  const updateM = (m) => m.id === machineId ? { ...m, photoBase64: base64 } : m;
                  setTodayMachines((prev) => prev.map(updateM));
                  setRoutine((prev) => {
                    if (!prev?.exercises) return prev;
                    return { ...prev, exercises: prev.exercises.map((ex) =>
                      ex.machine?.id === machineId ? { ...ex, machine: updatedMachine } : ex
                    )};
                  });
                  if (overrideExercises) {
                    const newOvr = overrideExercises.map((ex) =>
                      ex.machine?.id === machineId ? { ...ex, machine: updatedMachine } : ex
                    );
                    setOverrideExercises(newOvr);
                    localStorage.setItem(TODAY_OVERRIDE_KEY, JSON.stringify(newOvr));
                  }
                  setSession((prev) => {
                    if (!prev?.entries) return prev;
                    return { ...prev, entries: prev.entries.map((ent) =>
                      ent.machineId === machineId ? { ...ent, machine: updatedMachine } : ent
                    )};
                  });
                  setPhotoPreview({ ...photoPreview, machine: updatedMachine });
                };
                reader.readAsDataURL(file);
              }}
            />
          </Box>
        )}
      </Dialog>

      {/* Dialog: sugestão de atualização de PR */}
      <Dialog open={!!prSuggestion} maxWidth="xs" fullWidth
        PaperProps={{ sx: { bgcolor: "#071a12", backgroundImage: "none", borderRadius: 2 } }}
        slotProps={{ backdrop: { sx: { bgcolor: "rgba(2,6,23,0.8)" } } }}>
        {prSuggestion && (
          <Box sx={{ px: 3, pt: 3, pb: 2.5, textAlign: "center" }}>
            <Box sx={{ fontSize: "2.2rem", mb: 1, lineHeight: 1 }}>🏆</Box>
            <Typography fontWeight={900} fontSize="1rem" mb={0.3}>Novo máximo!</Typography>
            <Typography color="text.secondary" fontSize="0.85rem" mb={1.5}>
              {prSuggestion.machineName}
            </Typography>
            <Typography fontWeight={900} fontSize="2.2rem" color="#facc15" lineHeight={1.1} mb={0.5}>
              {prSuggestion.newPR}kg
            </Typography>
            {prSuggestion.oldPR != null && (
              <Typography fontSize="0.78rem" color="rgba(255,255,255,0.35)" mb={2}>
                PR anterior: {prSuggestion.oldPR}kg
              </Typography>
            )}
            <Typography color="text.secondary" fontSize="0.88rem" mb={2.5}>
              Deseja atualizar seu PR para {prSuggestion.newPR}kg?
            </Typography>
            <Stack direction="row" spacing={1.5}>
              <Button variant="outlined" fullWidth onClick={() => setPrSuggestion(null)}
                sx={{ py: 1.1, fontWeight: 700, borderColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.6)" }}>
                Não
              </Button>
              <Button variant="contained" fullWidth onClick={confirmPRUpdate}
                sx={{ py: 1.1, fontWeight: 800, bgcolor: "#facc15", color: "#000",
                  "&:hover": { bgcolor: "#eab308" } }}>
                Atualizar
              </Button>
            </Stack>
          </Box>
        )}
      </Dialog>

      {/* Dialog: PR prompt — primeiro treino sem PR */}
      <Dialog open={!!prPromptEx} onClose={() => setPrPromptEx(null)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { bgcolor: "#071a12", backgroundImage: "none", borderRadius: 2 } }}
        slotProps={{ backdrop: { sx: { bgcolor: "rgba(2,6,23,0.75)" } } }}>
        {prPromptEx && (
          <Box sx={{ px: 3, pt: 3, pb: 2.5, textAlign: "center" }}>
            <EmojiEventsIcon sx={{ fontSize: 40, color: "#facc15", mb: 1 }} />
            <Typography fontWeight={900} fontSize="1rem" mb={0.5}>{prPromptEx.machine.name}</Typography>
            {prPromptStep === "ask" ? (
              <>
                <Typography color="text.secondary" fontSize="0.88rem" mb={2.5}>
                  Você sabe seu PR nesse exercício?
                </Typography>
                <Stack direction="row" spacing={1.5}>
                  <Button variant="outlined" fullWidth onClick={() => { setPrPromptEx(null); doOpenLog(prPromptEx); }}
                    sx={{ py: 1.1, fontWeight: 700, borderColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.6)" }}>
                    Não sei
                  </Button>
                  <Button variant="contained" fullWidth onClick={() => setPrPromptStep("enter")}
                    sx={{ py: 1.1, fontWeight: 800 }}>
                    Sei
                  </Button>
                </Stack>
              </>
            ) : (
              <>
                <Typography color="text.secondary" fontSize="0.88rem" mb={1.5}>
                  Qual é o seu PR?
                </Typography>
                <Stack direction="row" alignItems="center" justifyContent="center" spacing={1.5} mb={2}>
                  <IconButton
                    onClick={() => setPrPromptValue((prev) => String(Math.max(0.5, (parseFloat(prev) || 0) - prPromptStep)))}
                    sx={{ width: 44, height: 44, bgcolor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.6)" }}>
                    <RemoveIcon sx={{ fontSize: 22 }} />
                  </IconButton>
                  <TextField
                    value={prPromptValue}
                    onChange={(e) => setPrPromptValue(e.target.value)}
                    type="number"
                    inputProps={{ min: 0.5, step: 1, style: { textAlign: "center", fontWeight: 900, fontSize: "1.6rem" } }}
                    sx={{ width: 110, "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
                    placeholder="0"
                  />
                  <IconButton
                    onClick={() => setPrPromptValue((prev) => String((parseFloat(prev) || 0) + prPromptStep))}
                    sx={{ width: 44, height: 44, bgcolor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.6)" }}>
                    <AddIcon sx={{ fontSize: 22 }} />
                  </IconButton>
                </Stack>
                <Stack direction="row" spacing={1} mb={1}>
                  {[1, 2.5, 5].map((s) => (
                    <Chip key={s} label={`±${s}`} size="small" clickable onClick={() => setPrPromptStep(s)}
                      sx={{ flex: 1, fontSize: "0.72rem",
                        bgcolor: prPromptStep === s ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.06)",
                        color: prPromptStep === s ? "#22c55e" : "rgba(255,255,255,0.5)",
                        border: prPromptStep === s ? "1px solid rgba(34,197,94,0.3)" : "1px solid transparent" }} />
                  ))}
                </Stack>
                <Stack direction="row" spacing={1.5} mt={1}>
                  <Button variant="outlined" fullWidth onClick={() => setPrPromptStep("ask")}
                    sx={{ py: 1.1, fontWeight: 700, borderColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.6)" }}>
                    Voltar
                  </Button>
                  <Button variant="contained" fullWidth
                    disabled={!prPromptValue || isNaN(parseFloat(prPromptValue)) || parseFloat(prPromptValue) <= 0}
                    onClick={async () => {
                      const pr = parseFloat(prPromptValue);
                      const ex = prPromptEx;
                      setPrPromptEx(null);
                      try { await api.patch(`/machines/${ex.machine.id}`, { currentPR: pr }); } catch {}
                      const updatedMachine = { ...ex.machine, currentPR: pr };
                      setTodayMachines((prev) => prev.map((m) => m.id === ex.machine.id ? { ...m, currentPR: pr } : m));
                      setRoutine((prev) => {
                        if (!prev?.exercises) return prev;
                        return { ...prev, exercises: prev.exercises.map((e) =>
                          e.machine?.id === ex.machine.id ? { ...e, machine: { ...e.machine, currentPR: pr } } : e
                        )};
                      });
                      doOpenLog({ ...ex, machine: updatedMachine });
                    }}
                    sx={{ py: 1.1, fontWeight: 800 }}>
                    Confirmar
                  </Button>
                </Stack>
              </>
            )}
          </Box>
        )}
      </Dialog>

      <HistoryDialog
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        sessions={history}
        loading={historyLoading}
        selectedSession={selectedHistSess}
        onSelectSession={setSelectedHistSess}
        onEditSession={handleEditSession}
        onCreateSession={handleCreateSession}
        onAddEntry={handleAddEntry}
        onDeleteSession={handleDeleteSession}
        machines={todayMachines}
        onMachineCreated={(m) => setTodayMachines((prev) => [...prev, m])}
      />

      <BottomNav />
    </Box>
  );
}
