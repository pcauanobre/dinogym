import { useState, useEffect } from "react";
import {
  Box, Typography, Button, Stack, CircularProgress, Container,
  Dialog, DialogContent, TextField, Chip, Divider, IconButton, Checkbox,
} from "@mui/material";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
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
import { useNavigate } from "react-router-dom";
import WifiOffIcon from "@mui/icons-material/WifiOff";
import api from "../utils/api.js";
import BottomNav from "../components/BottomNav.jsx";
import { getSimDay, getSimDayOffset } from "../utils/simDay.js";
import {
  cacheRoutineDay, getCachedRoutineDay,
  getOfflineSession, saveOfflineSession, clearOfflineSession,
  addPendingSession, syncPending,
} from "../utils/offlineQueue.js";
import { CATEGORY_GRADIENT, CATEGORY_COLOR } from "../constants/categories.js";
import { DAYS } from "../constants/dateLabels.js";
import { PAGE_BG } from "../constants/theme.js";
import ExerciseThumbnail from "../components/ExerciseThumbnail.jsx";
import FinishDialog from "./treino/FinishDialog.jsx";
import HistoryDialog from "./treino/HistoryDialog.jsx";
import EditEntryDialog from "./treino/EditEntryDialog.jsx";

const CONGRATS = [
  "Mais um treino no saco. Descansa!",
  "Arrasou hoje! Consistência é tudo.",
  "Treino concluído. Cada rep conta.",
  "Você ganhou hoje. Bora recuperar!",
  "Disciplina bate motivação todo dia.",
];

const WEIGHT_OPTIONS    = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 80, 90, 100, 120];
const REPS_OPTIONS      = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/* ─── Página principal ─── */
export default function Treino() {
  const navigate = useNavigate();
  const dow = getSimDay();

  const [session, setSession]   = useState(null);
  const [routine, setRoutine]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [isOffline, setIsOffline]         = useState(false);
  const [showOfflineBanner, setShowOfflineBanner] = useState(false);

  // Log dialog
  const [logEx, setLogEx]               = useState(null);
  const [logPhase, setLogPhase]         = useState("sets"); // "sets" | "comment"
  const [currentSet, setCurrentSet]     = useState(0);
  const [setStep, setSetStep]           = useState("manteve"); // "manteve" | "weight" | "reps"
  const [repsPrevStep, setRepsPrevStep] = useState("weight"); // onde o reps foi aberto
  const [loggedSets, setLoggedSets]     = useState([]);
  const [curWeight, setCurWeight]       = useState(null);
  const [isBackOff, setIsBackOff]       = useState(false);
  const [selectedWeight, setSelectedWeight] = useState(null);
  const [customWeight, setCustomWeight] = useState("");
  const [showCustom, setShowCustom]     = useState(false);
  const [selectedReps, setSelectedReps] = useState(null);
  const [customReps, setCustomReps]     = useState("");
  const [showCustomReps, setShowCustomReps] = useState(false);
  const [logComment, setLogComment]     = useState("");
  const [saving, setSaving]             = useState(false);

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
  const [todayMachines, setTodayMachines] = useState([]);
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

  // History dialog
  const [historyOpen, setHistoryOpen]         = useState(false);
  const [history, setHistory]                 = useState(null);
  const [historyLoading, setHistoryLoading]   = useState(false);
  const [selectedHistSess, setSelectedHistSess] = useState(null);

  const congratsMsg = CONGRATS[new Date().getDay() % CONGRATS.length];

  useEffect(() => {
    setLoading(true);
    setSession(null);
    async function load() {
      try {
        // Simulação: só precisa de rotina e máquinas, sessão vem do localStorage
        const isSim = getSimDayOffset() > 0;
        const [sesRes, routRes, machRes] = await Promise.all([
          isSim ? Promise.resolve({ data: null }) : api.get("/sessions/today"),
          api.get(`/routine/day/${dow}`),
          api.get("/machines"),
        ]);
        if (isSim) {
          const storedSim = localStorage.getItem(SIM_SESSION_KEY);
          setSession(storedSim ? JSON.parse(storedSim) : null);
        } else {
          setSession(sesRes.data);
        }
        setRoutine(routRes.data);
        setTodayMachines(machRes.data);
        if (routRes.data) cacheRoutineDay(dow, routRes.data);
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

  function openLog(ex) {
    setLogEx(ex);
    setLogPhase("sets");
    setCurrentSet(0);
    setSetStep("manteve");
    setRepsPrevStep("weight");
    setLoggedSets([]);
    setCurWeight(null);
    setIsBackOff(false);
    setSelectedWeight(null);
    setCustomWeight("");
    setShowCustom(false);
    setSelectedReps(null);
    setCustomReps("");
    setShowCustomReps(false);
    setLogComment("");
  }

  const finalWeight = selectedWeight ?? (customWeight ? parseFloat(customWeight) : null);
  const currentReps = selectedReps ?? (customReps ? parseInt(customReps) : null);

  function handleSetManteveYes() {
    if (logEx.machine.currentPR == null) { setSetStep("weight"); return; }
    setCurWeight(logEx.machine.currentPR);
    setRepsPrevStep("manteve");
    // Range: pula manteve-reps, vai direto pra picker de reps
    setSetStep(logEx.repsMax ? "reps" : "manteve-reps");
  }

  function handleSetManteveNo() { setSetStep("weight"); }

  function handleSetWeightConfirm() {
    if (!finalWeight) return;
    setCurWeight(finalWeight);
    setSelectedWeight(null);
    setCustomWeight("");
    setShowCustom(false);
    setRepsPrevStep("weight");
    // Range: pula manteve-reps, vai direto pra picker de reps
    setSetStep(logEx.repsMax ? "reps" : "manteve-reps");
  }

  function handleManteveRepsYes() {
    const reps = logEx.reps;
    const totalSets = logEx.sets || 1;
    const newLoggedSets = [...loggedSets, { weight: curWeight, reps, isBackOff }];
    setLoggedSets(newLoggedSets);
    if (currentSet + 1 < totalSets) {
      setCurrentSet((prev) => prev + 1);
      setSetStep("manteve");
      setRepsPrevStep("weight");
      setCurWeight(null);
      setIsBackOff(false);
      setSelectedReps(null);
      setCustomReps("");
      setShowCustomReps(false);
    } else {
      setLogPhase("comment");
    }
  }

  function handleManteveRepsNo() { setSetStep("reps"); }

  function handleSetRepsConfirm() {
    if (!currentReps) return;
    const totalSets = logEx.sets || 1;
    const newLoggedSets = [...loggedSets, { weight: curWeight, reps: currentReps, isBackOff }];
    setLoggedSets(newLoggedSets);
    if (currentSet + 1 < totalSets) {
      setCurrentSet((prev) => prev + 1);
      setSetStep("manteve");
      setRepsPrevStep("weight");
      setCurWeight(null);
      setIsBackOff(false);
      setSelectedReps(null);
      setCustomReps("");
      setShowCustomReps(false);
    } else {
      setLogPhase("comment");
    }
  }

  function handleSetNotDone() {
    const newLoggedSets = [...loggedSets, { weight: null, reps: 0, isBackOff: false, skipped: true }];
    setLoggedSets(newLoggedSets);
    const totalSets = logEx.sets || 1;
    if (currentSet + 1 < totalSets) {
      setCurrentSet((prev) => prev + 1);
      setSetStep("manteve");
      setCurWeight(null);
      setIsBackOff(false);
    } else {
      setLogPhase("comment");
    }
  }

  function handleManteveVoltar() {
    if (currentSet === 0) {
      handleDialogClose();
    } else {
      setCurrentSet((prev) => prev - 1);
      setLoggedSets((prev) => prev.slice(0, -1));
    }
  }

  async function handleFinalSave() {
    await commitEntry(loggedSets, logComment);
  }

  async function handleDialogClose() {
    if (saving || !logEx) return;
    if (loggedSets.length > 0) {
      await commitEntry(loggedSets, "");
    } else {
      setLogEx(null);
    }
  }

  async function commitEntry(setsDataArr, comment) {
    setSaving(true);
    const realSets  = setsDataArr.filter((s) => !s.skipped);
    const weights   = realSets.map((s) => s.weight).filter(Boolean);
    const maxWeight = weights.length > 0 ? Math.max(...weights) : 0;
    const pr        = logEx.machine.currentPR;
    const hitPR     = realSets.length > 0 && (pr == null || maxWeight > pr);
    const notes     = realSets.length > 0 && !hitPR && pr != null && maxWeight < pr ? "regrediu" : null;
    const isSim     = getSimDayOffset() > 0;

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

  async function openHistory() {
    setHistoryOpen(true);
    if (history) return;
    setHistoryLoading(true);
    const r = await api.get("/sessions/history");
    setHistory(r.data);
    if (r.data?.length) setSelectedHistSess(r.data[0]);
    setHistoryLoading(false);
  }

  function isLogged(machineId)  { return session?.entries?.some((e) => e.machineId === machineId); }
  function getEntry(machineId)  { return session?.entries?.find((e) => e.machineId === machineId); }

  function reopenLog(ex) {
    const updated = { ...session, entries: (session.entries || []).filter((e) => e.machineId !== ex.machine.id) };
    setSession(updated);
    if (getSimDayOffset() > 0) localStorage.setItem(SIM_SESSION_KEY, JSON.stringify(updated));
    openLog(ex);
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
    // Open dialog pre-populated with existing sets
    setLogEx(ex);
    setLogPhase("sets");
    setCurrentSet(sd.length);
    setSetStep("manteve");
    setRepsPrevStep("weight");
    setLoggedSets(sd);
    setCurWeight(null);
    setIsBackOff(false);
    setSelectedWeight(null);
    setCustomWeight("");
    setShowCustom(false);
    setSelectedReps(null);
    setCustomReps("");
    setShowCustomReps(false);
    setLogComment(entry.comment || "");
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
    const hitPR     = realSets.length > 0 && (pr == null || maxWeight > pr);
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
            <Box>
              <Typography variant="body2" color="text.secondary">
                {DAYS[dow]}{routine?.label ? ` · ${routine.label}` : " · treino de hoje"}
              </Typography>
              <Typography variant="h6" fontWeight={900} lineHeight={1.2}>
                {session?.finished && exercises.length > 0 ? "Treino finalizado" : exercises.length === 0 ? "Dia de descanso" : !session ? "Treino" : `${loggedCount}/${exercises.length} exercícios`}
              </Typography>
            </Box>
            {session?.finished && exercises.length > 0 ? (
              <Chip label="Finalizado ✓" size="small"
                sx={{ bgcolor: "rgba(34,197,94,0.15)", color: "#22c55e", fontWeight: 700, mt: 0.5 }} />
            ) : !session && exercises.length > 0 ? (
              <IconButton onClick={(e) => { openHistory(); }} sx={{ mt: 0.5, color: "rgba(255,255,255,0.45)" }}>
                <HistoryIcon />
              </IconButton>
            ) : session && !session.finished && exercises.length > 0 ? (
              <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mt: 0.5 }}>
                {editingToday && (
                  <IconButton onClick={restoreTodayRoutine}
                    sx={{ color: "rgba(255,255,255,0.4)" }}>
                    <UndoIcon />
                  </IconButton>
                )}
                <IconButton
                  onClick={editingToday ? () => setEditingToday(false) : startEditingToday}
                  sx={{ color: editingToday ? "#22c55e" : "rgba(255,255,255,0.4)" }}>
                  <EditIcon />
                </IconButton>
              </Stack>
            ) : null}
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
          </Box>
        ) : exercises.length === 0 ? (
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
          </Box>
        ) : !session ? (
          <Box sx={{ flex: 1, position: "relative", overflow: "hidden" }}>
            {/* Lista de exercícios ao fundo com blur */}
            <Box sx={{ filter: "blur(6px)", opacity: 0.5, pointerEvents: "none", pb: 4 }}>
              <Stack spacing={1.5}>
                {exercises.map((ex) => {
                  const catColor = CATEGORY_COLOR[ex.machine.category] || "#aaa";
                  return (
                    <Box key={ex.id} sx={{
                      borderRadius: 3, overflow: "hidden",
                      border: "1px solid rgba(255,255,255,0.08)",
                      background: "rgba(255,255,255,0.04)",
                    }}>
                      <Box sx={{ px: 2.5, py: 2.2, display: "flex", alignItems: "center", gap: 2 }}>
                        <ExerciseThumbnail machine={ex.machine} size={92} />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography fontWeight={800} fontSize="1.08rem" lineHeight={1.2}>{ex.machine.name}</Typography>
                          <Stack direction="row" alignItems="center" spacing={0.8} mt={0.5}>
                            <Chip label={ex.machine.category} size="small" sx={{
                              height: 20, fontSize: "0.65rem", fontWeight: 700,
                              bgcolor: `${catColor}18`, color: catColor, border: `1px solid ${catColor}33`,
                            }} />
                            <Typography fontSize="0.85rem" sx={{ color: "rgba(255,255,255,0.6)", fontWeight: 500 }}>
                              {ex.sets}×{ex.repsMax ? `${ex.reps}-${ex.repsMax}` : ex.reps}
                            </Typography>
                          </Stack>
                        </Box>
                      </Box>
                    </Box>
                  );
                })}
              </Stack>
            </Box>
            {/* Overlay CTA */}
            <Box sx={{
              position: "absolute", inset: 0, pb: "64px",
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              textAlign: "center",
              background: "radial-gradient(ellipse at center, rgba(2,6,23,0.85) 0%, rgba(2,6,23,0.5) 100%)",
            }}>
              <FitnessCenterIcon sx={{ fontSize: 52, color: "#22c55e", mb: 2, opacity: 0.85 }} />
              <Typography fontWeight={900} fontSize="1.3rem" mb={1}>Vamos iniciar o treino?</Typography>
              <Typography color="text.secondary" fontSize="0.85rem" mb={3}>
                {exercises.length} exercício{exercises.length !== 1 ? "s" : ""} programado{exercises.length !== 1 ? "s" : ""} para hoje
              </Typography>
              <Button variant="contained" onClick={() => startSession()} disabled={startingSession}
                sx={{ py: 1.4, fontWeight: 800, fontSize: "0.97rem", px: 5 }}>
                {startingSession ? <CircularProgress size={18} /> : "Vamos"}
              </Button>
              <Button variant="outlined" onClick={startCustomSession} disabled={startingSession}
                sx={{ mt: 1.5, py: 1.2, fontWeight: 700, fontSize: "0.88rem", px: 4,
                  borderColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.6)" }}>
                Treino personalizado
              </Button>
            </Box>
          </Box>
        ) : (
          /* ── Lista de exercícios (scroll só aqui) ── */
          <Box sx={{ flex: 1, overflowY: "auto", pb: 1 }}>
            {isCustomWorkout && (
              <Button startIcon={<AddIcon />} fullWidth variant="outlined"
                onClick={() => setAddCustomOpen(true)}
                sx={{ mb: 1.5, py: 1.2, borderRadius: 2.5, fontWeight: 700,
                  borderColor: "rgba(34,197,94,0.35)", color: "#22c55e",
                  "&:hover": { borderColor: "#22c55e", bgcolor: "rgba(34,197,94,0.06)" } }}>
                Adicionar exercício
              </Button>
            )}
            {isCustomWorkout && exercises.length === 0 && (
              <Box sx={{ textAlign: "center", pt: 4, pb: 2 }}>
                <FitnessCenterIcon sx={{ fontSize: 44, color: "rgba(255,255,255,0.1)", mb: 1 }} />
                <Typography color="text.secondary" fontSize="0.9rem">
                  Adicione o primeiro exercício para começar.
                </Typography>
              </Box>
            )}
            <Stack spacing={1.5}>
              {exercises.map((ex) => {
                const logged   = isLogged(ex.machine.id);
                const partial  = isPartial(ex);
                const entry    = getEntry(ex.machine.id);
                const catColor = CATEGORY_COLOR[ex.machine.category] || "#aaa";
                return (
                  <Box key={ex.id} sx={{
                    borderRadius: 3, overflow: "hidden",
                    border: logged && !partial ? "1px solid rgba(34,197,94,0.3)" : partial ? "1px solid rgba(217,119,6,0.3)" : "1px solid rgba(255,255,255,0.08)",
                    background: logged && !partial
                      ? "linear-gradient(135deg, rgba(34,197,94,0.09), rgba(34,197,94,0.02))"
                      : partial ? "rgba(217,119,6,0.04)"
                      : "rgba(255,255,255,0.04)",
                  }}>
                    <Box sx={{ px: 2.5, py: 2.2, display: "flex", alignItems: "center", gap: 2 }}>
                      <ExerciseThumbnail machine={ex.machine} size={92} />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Stack direction="row" alignItems="center" spacing={0.6} mb={0.5}>
                          <Typography fontWeight={800} fontSize="1.08rem" lineHeight={1.2}>{ex.machine.name}</Typography>
                          {entry?.hitPR && <EmojiEventsIcon sx={{ fontSize: 16, color: "#facc15", flexShrink: 0 }} />}
                        </Stack>
                        <Stack direction="row" alignItems="center" spacing={0.8} flexWrap="wrap">
                          <Chip label={ex.machine.category} size="small" sx={{
                            height: 20, fontSize: "0.65rem", fontWeight: 700,
                            bgcolor: `${catColor}18`, color: catColor, border: `1px solid ${catColor}33`,
                          }} />
                          <Typography fontSize="0.85rem" sx={{ color: "rgba(255,255,255,0.6)", fontWeight: 500 }}>
                            {ex.sets}×{ex.repsMax ? `${ex.reps}-${ex.repsMax}` : ex.reps}{ex.machine.currentPR != null ? ` · PR: ${ex.machine.currentPR}kg` : ""}
                          </Typography>
                        </Stack>
                        {entry && !partial && (() => {
                          if (!entry.weight) return (
                            <Typography sx={{ display: "block", color: "rgba(255,255,255,0.35)", fontWeight: 700, mt: 0.6, fontSize: "0.85rem" }}>
                              Não realizado
                            </Typography>
                          );
                          const evo = calcEvolution(entry, ex);
                          if (evo === null) return (
                            <Typography sx={{ display: "block", color: "#22c55e", fontWeight: 700, mt: 0.6, fontSize: "0.85rem" }}>
                              Primeiro registro
                            </Typography>
                          );
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
                        <IconButton onClick={() => setConfirmDeleteMachineId(ex.machine.id)}
                          sx={{ color: "#ef4444", flexShrink: 0 }}>
                          <DeleteIcon />
                        </IconButton>
                      ) : partial ? (
                        <Button variant="contained" onClick={(e) => { continueLog(ex); }}
                          sx={{ flexShrink: 0, px: 2.5, py: 1.3, fontSize: "0.88rem", fontWeight: 800, borderRadius: 2.5,
                            bgcolor: "#d97706", "&:hover": { bgcolor: "#b45309" } }}>
                          Continuar
                        </Button>
                      ) : !logged ? (
                        <Button variant="contained" onClick={(e) => { openLog(ex); }}
                          sx={{ flexShrink: 0, px: 3, py: 1.3, fontSize: "0.88rem", fontWeight: 800, borderRadius: 2.5 }}>
                          Anotar
                        </Button>
                      ) : (
                        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ flexShrink: 0 }}>
                          <CheckCircleIcon sx={{ color: "#22c55e", fontSize: 26 }} />
                          <IconButton size="small" onClick={(e) => { openEditMode(ex); }}
                            sx={{ color: "rgba(255,255,255,0.35)", "&:hover": { color: "rgba(255,255,255,0.7)" } }}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Stack>
                      )}
                    </Box>
                  </Box>
                );
              })}
            </Stack>
            {editingToday && (
              <Button startIcon={<AddIcon />} fullWidth variant="outlined" onClick={() => setAddTodayOpen(true)}
                sx={{ mt: 1.5, borderColor: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.6)", borderRadius: 2 }}>
                Adicionar exercício hoje
              </Button>
            )}
          </Box>
        )}
      </Container>

      {/* Barra fixa: Finalizar treino — dentro do flex, não sobrepõe a lista */}
      {session && !session.finished && exercises.length > 0 && (
        <Box sx={{
          flexShrink: 0, height: 176, pb: "64px",
          display: "flex", justifyContent: "center", alignItems: "center",
          borderTop: "1px solid rgba(255,255,255,0.06)",
        }}>
          <Button variant="contained" onClick={(e) => { setFinishDialog(true); }}
            sx={{ py: 1.4, px: 7, fontWeight: 800, fontSize: "0.97rem", borderRadius: 3, boxShadow: "0 4px 28px rgba(0,0,0,0.7)" }}>
            Finalizar treino
          </Button>
        </Box>
      )}

      {/* Dialog: anotar */}
      <Dialog open={!!logEx} onClose={handleDialogClose} fullWidth maxWidth="xs"
        slotProps={{ backdrop: { sx: { bgcolor: "rgba(2,6,23,0.75)" } } }}>
        {logEx && (
          <Box sx={{ pb: 1 }}>
            {/* Header */}
            <Box sx={{ px: 3, pt: 3, pb: 0, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Typography fontWeight={900} fontSize="1rem">{logEx.machine.name}</Typography>
              <ExerciseThumbnail machine={logEx.machine} size={44} />
            </Box>

            {/* Set indicator — prominent */}
            {logPhase === "sets" && (
              <Box sx={{ textAlign: "center", mt: 2, mb: 0.5 }}>
                <Typography fontWeight={900} fontSize="1.25rem" color="#22c55e" lineHeight={1.1}>
                  Série {currentSet + 1}
                  <Typography component="span" fontWeight={400} fontSize="0.85rem" color="text.secondary"> / {logEx.sets || 1}</Typography>
                </Typography>
                {logEx.repsMax && setStep === "reps" && (
                  <Typography fontSize="0.75rem" color="rgba(255,255,255,0.3)" mt={0.3}>
                    Range: {logEx.reps}–{logEx.repsMax} reps
                  </Typography>
                )}
              </Box>
            )}

            {/* STEP: manteve */}
            {logPhase === "sets" && setStep === "manteve" && (
              <Box sx={{ px: 3, pt: 3, pb: 4, textAlign: "center" }}>
                <Typography fontWeight={700} fontSize="0.85rem" color="text.secondary" mb={0.5}>
                  Manteve o PR?
                </Typography>
                <Typography fontWeight={900} fontSize="2.4rem"
                  color={logEx.machine.currentPR != null ? "#22c55e" : "text.secondary"} lineHeight={1.1}>
                  {logEx.machine.currentPR != null ? `${logEx.machine.currentPR}kg` : "—"}
                </Typography>
                <Stack direction="row" spacing={1.5} mt={3}>
                  <Button variant="outlined" fullWidth onClick={handleSetManteveNo}
                    sx={{ py: 1, fontSize: "0.88rem", fontWeight: 700,
                      borderColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.7)" }}>
                    Não
                  </Button>
                  <Button variant="contained" fullWidth onClick={handleSetManteveYes}
                    sx={{ py: 1, fontSize: "0.88rem", fontWeight: 800 }}>
                    Sim
                  </Button>
                </Stack>

                <Button variant="outlined" fullWidth onClick={handleSetNotDone}
                  sx={{ mt: 2.5, py: 1.1, fontWeight: 700, fontSize: "0.85rem", borderRadius: 2.5,
                    borderColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.6)",
                    "&:hover": { borderColor: "rgba(255,255,255,0.3)", bgcolor: "rgba(255,255,255,0.04)" } }}>
                  Não fiz essa série
                </Button>
                <Divider sx={{ mt: 2, borderColor: "rgba(255,255,255,0.07)" }} />
                <Button variant="outlined" fullWidth onClick={handleManteveVoltar}
                  sx={{ mt: 2, py: 1.2, fontWeight: 700, fontSize: "0.88rem", borderRadius: 2.5,
                    borderColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.6)",
                    "&:hover": { borderColor: "rgba(255,255,255,0.3)", bgcolor: "rgba(255,255,255,0.04)" } }}>
                  Voltar
                </Button>
              </Box>
            )}

            {/* STEP: weight */}
            {logPhase === "sets" && setStep === "weight" && (
              <Box sx={{ px: 2.5, pt: 2, pb: 0 }}>
                <Typography variant="caption" color="text.secondary" fontWeight={700} letterSpacing={0.5}>
                  QUANTO VOCÊ FEZ? (KG)
                </Typography>
                <Box sx={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 0.8, mt: 1 }}>
                  {(() => {
                    const curPR = logEx.machine.currentPR;
                    const cols  = 6;
                    let opts = [...WEIGHT_OPTIONS];
                    if (curPR != null && !opts.includes(curPR)) {
                      opts.push(curPR);
                      opts.sort((a, b) => a - b);
                      if (opts.length % cols !== 0) {
                        for (let i = opts.length - 1; i >= 0; i--) {
                          if (opts[i] !== curPR) { opts.splice(i, 1); break; }
                        }
                      }
                    }
                    return opts.map((w) => {
                      const isCurPR = curPR != null && w === curPR;
                      const isAbove = curPR != null && w > curPR;
                      const sel     = selectedWeight === w;
                      return (
                        <Box key={w} onClick={() => { setSelectedWeight(w); setShowCustom(false); setCustomWeight(""); }}
                          sx={{
                            py: 1.1, borderRadius: 2, cursor: "pointer", textAlign: "center",
                            fontWeight: 800, fontSize: "0.85rem",
                            border: sel ? "2px solid #22c55e" : isCurPR ? "2px solid rgba(255,255,255,0.7)"
                              : isAbove ? "2px solid rgba(250,204,21,0.2)" : "2px solid rgba(255,255,255,0.07)",
                            outline: isCurPR && !sel ? "1px solid rgba(255,255,255,0.35)" : "none",
                            outlineOffset: "1px",
                            bgcolor: sel ? "rgba(34,197,94,0.18)" : isCurPR ? "rgba(255,255,255,0.08)"
                              : isAbove ? "rgba(250,204,21,0.06)" : "rgba(255,255,255,0.05)",
                            color: sel ? "#22c55e" : isCurPR ? "rgba(255,255,255,0.9)" : isAbove ? "#facc15" : "rgba(255,255,255,0.75)",
                            transition: "all 0.12s", "&:active": { transform: "scale(0.95)" },
                          }}>
                          {w}
                        </Box>
                      );
                    });
                  })()}
                </Box>
                <Box sx={{ display: "flex", justifyContent: "center", mt: 0.8, mb: 0.5 }}>
                  <Box onClick={() => { setShowCustom(true); setSelectedWeight(null); }}
                    sx={{
                      px: 3, py: 1.1, borderRadius: 2, cursor: "pointer",
                      fontWeight: 700, fontSize: "0.82rem",
                      border: showCustom ? "2px solid #22c55e" : "1px solid rgba(255,255,255,0.1)",
                      bgcolor: showCustom ? "rgba(34,197,94,0.18)" : "rgba(255,255,255,0.04)",
                      color:  showCustom ? "#22c55e" : "rgba(255,255,255,0.45)",
                    }}>
                    Outro
                  </Box>
                </Box>
                {showCustom && (
                  <TextField label="Peso (kg)" type="number" value={customWeight} autoFocus
                    onChange={(e) => setCustomWeight(e.target.value)}
                    size="small" fullWidth sx={{ mt: 1.2 }} inputProps={{ min: 0, step: 0.5 }} />
                )}
                {currentSet > 0 && (
                  <Box onClick={() => setIsBackOff(!isBackOff)}
                    sx={{ display: "flex", alignItems: "center", mt: 1.5, cursor: "pointer", userSelect: "none", width: "fit-content" }}>
                    <Checkbox checked={isBackOff} onChange={(e) => setIsBackOff(e.target.checked)}
                      sx={{ p: 0.5, color: "rgba(255,255,255,0.25)", transform: "scale(1.25)",
                        "&.Mui-checked": { color: "#facc15" } }} />
                    <Typography fontSize="0.92rem" fontWeight={700} ml={0.8}
                      color={isBackOff ? "#facc15" : "rgba(255,255,255,0.45)"}>
                      Back-off
                    </Typography>
                  </Box>
                )}
                <Box sx={{ py: 2.5, display: "flex", flexDirection: "column", gap: 1 }}>
                  <Button variant="contained" fullWidth onClick={handleSetWeightConfirm}
                    disabled={!finalWeight}
                    sx={{ py: 1.4, fontWeight: 800, fontSize: "0.9rem", borderRadius: 2.5 }}>
                    Próximo
                  </Button>
                  <Button variant="outlined" fullWidth onClick={() => setSetStep("manteve")}
                    sx={{ py: 1.2, fontWeight: 700, fontSize: "0.88rem", borderRadius: 2.5,
                      borderColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.6)",
                      "&:hover": { borderColor: "rgba(255,255,255,0.3)", bgcolor: "rgba(255,255,255,0.04)" } }}>
                    Voltar
                  </Button>
                </Box>
              </Box>
            )}

            {/* STEP: manteve-reps */}
            {logPhase === "sets" && setStep === "manteve-reps" && (
              <Box sx={{ px: 3, pt: 3, pb: 4, textAlign: "center" }}>
                <Typography fontWeight={700} fontSize="0.85rem" color="text.secondary" mb={0.5}>
                  Manteve as reps?
                </Typography>
                <Typography fontWeight={900} fontSize="2.4rem" color="#22c55e" lineHeight={1.1}>
                  {logEx.repsMax ? `${logEx.reps}-${logEx.repsMax}` : logEx.reps}
                </Typography>
                {currentSet > 0 && (
                  <Box onClick={() => setIsBackOff(!isBackOff)}
                    sx={{ display: "flex", alignItems: "center", justifyContent: "center", mt: 1.5, cursor: "pointer", userSelect: "none" }}>
                    <Checkbox checked={isBackOff} onChange={(e) => setIsBackOff(e.target.checked)}
                      sx={{ p: 0.5, color: "rgba(255,255,255,0.25)", transform: "scale(1.25)",
                        "&.Mui-checked": { color: "#facc15" } }} />
                    <Typography fontSize="0.92rem" fontWeight={700} ml={0.8}
                      color={isBackOff ? "#facc15" : "rgba(255,255,255,0.45)"}>
                      Back-off
                    </Typography>
                  </Box>
                )}
                <Stack direction="row" spacing={1.5} mt={3}>
                  <Button variant="outlined" fullWidth onClick={handleManteveRepsNo}
                    sx={{ py: 1, fontSize: "0.88rem", fontWeight: 700,
                      borderColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.7)" }}>
                    Não
                  </Button>
                  <Button variant="contained" fullWidth onClick={handleManteveRepsYes}
                    sx={{ py: 1, fontSize: "0.88rem", fontWeight: 800 }}>
                    Sim
                  </Button>
                </Stack>
                <Button variant="outlined" fullWidth onClick={handleSetNotDone}
                  sx={{ mt: 2.5, py: 1.1, fontWeight: 700, fontSize: "0.85rem", borderRadius: 2.5,
                    borderColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.6)",
                    "&:hover": { borderColor: "rgba(255,255,255,0.3)", bgcolor: "rgba(255,255,255,0.04)" } }}>
                  Não fiz essa série
                </Button>
                <Divider sx={{ mt: 2, borderColor: "rgba(255,255,255,0.07)" }} />
                <Button variant="outlined" fullWidth onClick={() => setSetStep(repsPrevStep)}
                  sx={{ mt: 2, py: 1.2, fontWeight: 700, fontSize: "0.88rem", borderRadius: 2.5,
                    borderColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.6)",
                    "&:hover": { borderColor: "rgba(255,255,255,0.3)", bgcolor: "rgba(255,255,255,0.04)" } }}>
                  Voltar
                </Button>
              </Box>
            )}

            {/* STEP: reps */}
            {logPhase === "sets" && setStep === "reps" && (
              <Box sx={{ px: 3, pt: 3, pb: 4 }}>
                <Typography variant="caption" color="text.secondary" fontWeight={700} letterSpacing={0.5} display="block" mb={0.5} textAlign="center">
                  QUANTAS REPETIÇÕES?
                </Typography>
                <Typography color="rgba(255,255,255,0.6)" fontSize="1.1rem" fontWeight={700} textAlign="center" mb={1.5}>
                  {curWeight}kg
                </Typography>
                <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 0.8, mb: 0.5 }}>
                  {REPS_OPTIONS.map((r) => {
                    const sel = selectedReps === r;
                    return (
                      <Box key={r} onClick={() => { setSelectedReps(r); setShowCustomReps(false); setCustomReps(""); }}
                        sx={{
                          py: 1.2, borderRadius: 2, cursor: "pointer", textAlign: "center",
                          fontWeight: 800, fontSize: "0.9rem",
                          border: sel ? "2px solid #22c55e" : "2px solid rgba(255,255,255,0.07)",
                          bgcolor: sel ? "rgba(34,197,94,0.18)" : "rgba(255,255,255,0.05)",
                          color:  sel ? "#22c55e" : "rgba(255,255,255,0.75)",
                          transition: "all 0.12s", "&:active": { transform: "scale(0.95)" },
                        }}>
                        {r}
                      </Box>
                    );
                  })}
                </Box>
                <Box sx={{ display: "flex", justifyContent: "center", mt: 0.8, mb: 0.5 }}>
                  <Box onClick={() => { setShowCustomReps(true); setSelectedReps(null); }}
                    sx={{
                      px: 3, py: 1.2, borderRadius: 2, cursor: "pointer",
                      fontWeight: 700, fontSize: "0.82rem",
                      border: showCustomReps ? "2px solid #22c55e" : "1px solid rgba(255,255,255,0.1)",
                      bgcolor: showCustomReps ? "rgba(34,197,94,0.18)" : "rgba(255,255,255,0.04)",
                      color:  showCustomReps ? "#22c55e" : "rgba(255,255,255,0.45)",
                    }}>
                    Outro
                  </Box>
                </Box>
                {showCustomReps && (
                  <TextField label="Repetições" type="number" value={customReps} autoFocus
                    onChange={(e) => setCustomReps(e.target.value)}
                    size="small" fullWidth sx={{ mt: 1.2 }} inputProps={{ min: 1, step: 1 }} />
                )}
                {currentSet > 0 && (
                  <Box onClick={() => setIsBackOff(!isBackOff)}
                    sx={{ display: "flex", alignItems: "center", mt: 1.5, cursor: "pointer", userSelect: "none", width: "fit-content" }}>
                    <Checkbox checked={isBackOff} onChange={(e) => setIsBackOff(e.target.checked)}
                      sx={{ p: 0.5, color: "rgba(255,255,255,0.25)", transform: "scale(1.25)",
                        "&.Mui-checked": { color: "#facc15" } }} />
                    <Typography fontSize="0.92rem" fontWeight={700} ml={0.8}
                      color={isBackOff ? "#facc15" : "rgba(255,255,255,0.45)"}>
                      Back-off
                    </Typography>
                  </Box>
                )}
                <Box sx={{ mt: 1.5, display: "flex", flexDirection: "column", gap: 1 }}>
                  <Button variant="contained" fullWidth onClick={handleSetRepsConfirm}
                    disabled={!currentReps}
                    sx={{ py: 1.4, fontWeight: 800, fontSize: "0.9rem", borderRadius: 2.5 }}>
                    {currentSet + 1 < (logEx.sets || 1) ? "Próxima série" : "Concluir séries"}
                  </Button>
                  <Button variant="outlined" fullWidth
                    onClick={() => { setSetStep(logEx.repsMax ? repsPrevStep : "manteve-reps"); setSelectedReps(null); setCustomReps(""); setShowCustomReps(false); }}
                    sx={{ py: 1.2, fontWeight: 700, fontSize: "0.88rem", borderRadius: 2.5,
                      borderColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.6)",
                      "&:hover": { borderColor: "rgba(255,255,255,0.3)", bgcolor: "rgba(255,255,255,0.04)" } }}>
                    Voltar
                  </Button>
                </Box>
              </Box>
            )}


            {/* PHASE: comment */}
            {logPhase === "comment" && (
              <Box sx={{ px: 3, pt: 3, pb: 4 }}>
                <Box sx={{ mb: 2.5, display: "flex", flexDirection: "column", gap: 0.8 }}>
                  {loggedSets.map((s, i) => (
                    <Box key={i} sx={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      px: 2, py: 1.1, borderRadius: 2,
                      bgcolor: s.skipped ? "rgba(255,255,255,0.03)" : s.isBackOff ? "rgba(250,204,21,0.07)" : "rgba(34,197,94,0.08)",
                      border: `1px solid ${s.skipped ? "rgba(255,255,255,0.08)" : s.isBackOff ? "rgba(250,204,21,0.2)" : "rgba(34,197,94,0.2)"}`,
                    }}>
                      <Typography fontSize="0.8rem" fontWeight={600} color="text.secondary">
                        Série {i + 1}
                      </Typography>
                      <Typography fontSize="0.88rem" fontWeight={700}
                        color={s.skipped ? "rgba(255,255,255,0.3)" : s.isBackOff ? "#facc15" : "#22c55e"}>
                        {s.skipped ? "não feita" : `${s.weight}kg × ${s.reps}${s.isBackOff ? " · back-off" : ""}`}
                      </Typography>
                    </Box>
                  ))}
                </Box>
                <TextField
                  label="Comentários (opcional)"
                  multiline
                  rows={3}
                  value={logComment}
                  onChange={(e) => setLogComment(e.target.value)}
                  fullWidth
                  sx={{ mb: 2.5 }}
                  placeholder="Como foi o exercício?"
                />
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  <Button variant="contained" fullWidth onClick={handleFinalSave}
                    disabled={saving}
                    sx={{ py: 1.4, fontWeight: 800, fontSize: "0.95rem", borderRadius: 2.5 }}>
                    {saving ? <CircularProgress size={20} /> : "Salvar exercício"}
                  </Button>
                  <Button variant="outlined" fullWidth
                    onClick={() => {
                      const idx = loggedSets.length - 1;
                      setLoggedSets((prev) => prev.slice(0, -1));
                      setCurrentSet(idx);
                      setSetStep("manteve");
                      setLogPhase("sets");
                    }}
                    sx={{ py: 1.2, fontWeight: 700, fontSize: "0.88rem", borderRadius: 2.5,
                      borderColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.6)",
                      "&:hover": { borderColor: "rgba(255,255,255,0.3)", bgcolor: "rgba(255,255,255,0.04)" } }}>
                    Voltar
                  </Button>
                </Box>
              </Box>
            )}
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

      {/* Dialog: confirmar exclusão do exercício de hoje */}
      <Dialog open={!!confirmDeleteMachineId} onClose={() => setConfirmDeleteMachineId(null)} maxWidth="xs" fullWidth>
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

      {/* Dialog: adicionar exercício (hoje ou personalizado) */}
      <Dialog open={addTodayOpen || addCustomOpen} onClose={() => { setAddTodayOpen(false); setAddCustomOpen(false); }} fullWidth maxWidth="sm">
        <Box sx={{ px: 2.5, pt: 2.5, pb: 1, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Typography fontWeight={900} fontSize="1rem">{addCustomOpen ? "Adicionar exercício" : "Adicionar hoje"}</Typography>
          <IconButton size="small" onClick={() => { setAddTodayOpen(false); setAddCustomOpen(false); }}><CloseIcon fontSize="small" /></IconButton>
        </Box>
        <Box sx={{ px: 2, pb: 2, overflowY: "auto", maxHeight: "60vh" }}>
          <Stack spacing={0.8}>
            {todayMachines.map((m) => (
              <Box key={m.id} onClick={() => addCustomOpen ? addCustomExercise(m) : addTodayExercise(m)}
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
        </Box>
      </Dialog>

      <HistoryDialog
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        sessions={history}
        loading={historyLoading}
        selectedSession={selectedHistSess}
        onSelectSession={setSelectedHistSess}
      />

      <BottomNav />
    </Box>
  );
}
