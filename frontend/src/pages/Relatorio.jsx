import { useState, useEffect, useMemo } from "react";
import {
  Box, Typography, Stack, IconButton, CircularProgress, Container,
  MenuItem, TextField, Dialog, DialogContent,
} from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import FitnessCenterIcon from "@mui/icons-material/FitnessCenter";
import TimerIcon from "@mui/icons-material/Timer";
import WhatshotIcon from "@mui/icons-material/Whatshot";
import HistoryIcon from "@mui/icons-material/History";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import CloseIcon from "@mui/icons-material/Close";
import {
  XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, AreaChart, Area, PieChart, Pie,
} from "recharts";
import ReactApexChart from "react-apexcharts";
import api from "../utils/api.js";
import {
  getCachedMachines, cacheMachines,
  getCachedAllRoutine, cacheAllRoutine,
  getCachedHistory, cacheHistory,
  getCachedReport, cacheReport,
} from "../utils/offlineQueue.js";
import HistoryDialog from "./treino/HistoryDialog.jsx";
import Glass from "../components/Glass.jsx";
import BottomNav from "../components/BottomNav.jsx";
import { PAGE_BG } from "../constants/theme.js";
import { CATEGORY_COLOR } from "../constants/categories.js";

const MONTH_NAMES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const MONTH_FULL = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const DAYS = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];

function fmtLabel(dateStr, period) {
  const d = new Date(dateStr);
  if (period === 1) return d.getDate();
  return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
}

const TT_STYLE = { background: "rgba(10,18,40,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, fontSize: 12 };

function StatCard({ label, value, sub, color = "primary", icon }) {
  return (
    <Glass sx={{ flex: 1, p: 2, textAlign: "center" }}>
      {icon && <Box sx={{ mb: 0.5 }}>{icon}</Box>}
      <Typography variant="h5" fontWeight={900} color={color}>{value}</Typography>
      <Typography variant="body2" fontWeight={700}>{label}</Typography>
      {sub && <Typography variant="caption" color="text.secondary">{sub}</Typography>}
    </Glass>
  );
}

function CompareChip({ current, previous, suffix = "", invert = false }) {
  if (previous == null || previous === 0) return null;
  const diff = current - previous;
  const pct = ((diff / previous) * 100).toFixed(0);
  const up = invert ? diff < 0 : diff > 0;
  const color = diff === 0 ? "#facc15" : up ? "#22c55e" : "#ef4444";
  const sign = diff > 0 ? "+" : "";
  return (
    <Typography component="span" fontSize="0.7rem" fontWeight={700} sx={{ color, ml: 0.5 }}>
      {sign}{pct}%{suffix}
    </Typography>
  );
}

export default function Relatorio() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [period, setPeriod] = useState(1);
  const [data, setData] = useState(null);
  const [prevData, setPrevData] = useState(null);
  const [routine, setRoutine] = useState(() => getCachedAllRoutine());
  const [machines, setMachines] = useState(() => getCachedMachines());
  const [loading, setLoading] = useState(true);

  const [selectedMachine, setSelectedMachine] = useState("");

  const [historyOpen, setHistoryOpen]           = useState(false);
  const [history, setHistory]                   = useState(() => getCachedHistory());
  const [historyLoading, setHistoryLoading]     = useState(false);
  const [selectedHistSess, setSelectedHistSess] = useState(() => { const h = getCachedHistory(); return h?.length ? h[0] : null; });

  const [scrolled, setScrolled] = useState(false);

  const [rangeOpen, setRangeOpen]   = useState(false);
  const [rangeStart, setRangeStart] = useState(null);   // { year, month }
  const [rangeHover, setRangeHover] = useState(null);   // { year, month }
  const [pickerYear, setPickerYear] = useState(now.getFullYear());

  // Build list of [year, month] for the selected period
  const monthRange = useMemo(() => {
    const months = [];
    for (let i = period - 1; i >= 0; i--) {
      let m = month - i;
      let y = year;
      while (m <= 0) { m += 12; y--; }
      months.push([y, m]);
    }
    return months;
  }, [year, month, period]);

  useEffect(() => {
    // Cache-first: show immediately if all months are cached
    const cachedMonths = monthRange.map(([y, m]) => getCachedReport(y, m));
    const allCached = cachedMonths.every(Boolean);
    if (allCached) {
      const mergedSessions = cachedMonths.flatMap((d) => d.sessions || []);
      const totalPRs = cachedMonths.reduce((sum, d) => sum + (d.prsBeaten || 0), 0);
      setData({ sessions: mergedSessions, totalSessions: mergedSessions.length, prsBeaten: totalPRs });
      setLoading(false);
    } else {
      setLoading(true);
    }

    // Fetch fresh in background
    const prevM = month === 1 ? 12 : month - 1;
    const prevY = month === 1 ? year - 1 : year;
    Promise.all([
      ...monthRange.map(([y, m]) => api.get(`/sessions/report/${y}/${m}`)),
      api.get(`/sessions/report/${prevY}/${prevM}`),
      api.get("/routine"),
      api.get("/machines"),
    ]).then((results) => {
      const monthResults = results.slice(0, monthRange.length);
      const pr = results[monthRange.length];
      const rt = results[monthRange.length + 1];
      const mc = results[monthRange.length + 2];
      monthResults.forEach((r, i) => {
        const [y, m] = monthRange[i];
        cacheReport(y, m, r.data);
      });
      const mergedSessions = monthResults.flatMap((r) => r.data.sessions || []);
      const totalPRs = monthResults.reduce((sum, r) => sum + (r.data.prsBeaten || 0), 0);
      const merged = { sessions: mergedSessions, totalSessions: mergedSessions.length, prsBeaten: totalPRs };
      setData(merged);
      setPrevData(pr.data);
      setRoutine(rt.data);
      setMachines(mc.data);
      cacheAllRoutine(rt.data);
      cacheMachines(mc.data);
      const entryMachineIds = new Set();
      mergedSessions.forEach((s) => (s.entries || []).forEach((e) => entryMachineIds.add(e.machineId)));
      const firstWithData = mc.data.find((m) => entryMachineIds.has(m.id));
      if (firstWithData) setSelectedMachine(firstWithData.id);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [year, month, period]);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 80);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12); } else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1); } else setMonth(m => m + 1);
  }

  async function fetchHistory() {
    if (history) return;
    const cached = getCachedHistory();
    if (cached?.length) { setHistory(cached); setSelectedHistSess(cached[0]); return; }
    setHistoryLoading(true);
    try {
      const r = await api.get("/sessions/history");
      cacheHistory(r.data);
      setHistory(r.data);
      if (r.data?.length) setSelectedHistSess(r.data[0]);
    } catch { setHistory([]); }
    finally { setHistoryLoading(false); }
  }

  function openHistory() { setHistoryOpen(true); fetchHistory(); }

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
  }

  function openRangePicker() {
    setRangeOpen(true);
    setRangeStart(null);
    setRangeHover(null);
    setPickerYear(now.getFullYear());
    fetchHistory();
  }

  function closeRangePicker() { setRangeOpen(false); setRangeStart(null); setRangeHover(null); }

  function handleMonthClick(y, m) {
    if (!rangeStart) {
      setRangeStart({ year: y, month: m });
    } else {
      const sv = rangeStart.year * 12 + rangeStart.month;
      const ev = y * 12 + m;
      let sy, sm, ey, em;
      if (ev >= sv) { sy = rangeStart.year; sm = rangeStart.month; ey = y; em = m; }
      else          { sy = y; sm = m; ey = rangeStart.year; em = rangeStart.month; }
      const newPeriod = (ey - sy) * 12 + (em - sm) + 1;
      setYear(ey); setMonth(em); setPeriod(newPeriod);
      closeRangePicker();
    }
  }

  const monthsWithData = useMemo(() => {
    if (!history) return new Set();
    const s = new Set();
    history.forEach(sess => {
      const d = new Date(sess.date);
      s.add(`${d.getFullYear()}-${d.getMonth() + 1}`);
    });
    return s;
  }, [history]);

  const minPickerYear = useMemo(() => {
    const floor = now.getFullYear() - 2;
    if (!history || history.length === 0) return now.getFullYear() - 1;
    return Math.min(now.getFullYear() - 1, ...history.map(s => new Date(s.date).getFullYear()), floor);
  }, [history]);

  // ── Derived data ──

  const sessions = data?.sessions || [];
  const prevSessions = prevData?.sessions || [];

  // Aggregate sessions by calendar month (used for multi-month charts)
  const sessionsByMonth = useMemo(() => {
    const map = {};
    sessions.forEach((s) => {
      const d = new Date(s.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!map[key]) map[key] = { key, label: MONTH_NAMES[d.getMonth()], month: d.getMonth() + 1, year: d.getFullYear(), sessions: [] };
      map[key].sessions.push(s);
    });
    return Object.values(map).sort((a, b) => a.key.localeCompare(b.key));
  }, [sessions]);


  // 3. Frequência (heatmap calendar)
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDow = new Date(year, month - 1, 1).getDay();
  const sessionDays = new Set(sessions.map((s) => new Date(s.date).getDate()));
  const routineDows = new Set(routine.filter(r => r.exercises?.length > 0).map(r => r.dayOfWeek));

  // 4. Distribuição por grupo muscular (pie)
  const categoryMap = useMemo(() => {
    const map = {};
    sessions.forEach((s) => {
      (s.entries || []).forEach((e) => {
        const cat = e.machine?.category || "Outro";
        map[cat] = (map[cat] || 0) + 1;
      });
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [sessions]);

  // 5. Duração dos treinos
  const durationData = period === 1
    ? sessions.filter(s => s.duration > 0).map((s) => ({
        label: fmtLabel(s.date, period),
        minutos: Math.round(s.duration / 60),
      }))
    : sessionsByMonth.map(({ label, sessions: ms }) => {
        const withDur = ms.filter(s => s.duration > 0);
        const avg = withDur.length > 0 ? Math.round(withDur.reduce((t, s) => t + s.duration / 60, 0) / withDur.length) : null;
        return { label, minutos: avg };
      }).filter(d => d.minutos !== null);
  const avgDuration = durationData.length > 0
    ? Math.round(durationData.reduce((s, d) => s + d.minutos, 0) / durationData.length)
    : 0;
  const prevDurations = prevSessions.filter(s => s.duration > 0);
  const prevAvgDuration = prevDurations.length > 0
    ? Math.round(prevDurations.reduce((s, d) => s + d.duration / 60, 0) / prevDurations.length)
    : 0;



  // 8. Evolução média por sessão
  const evoData = period === 1
    ? sessions.map((s) => {
        const evos = (s.entries || []).map((e) => {
          if (!e.previousPR || e.previousPR === 0) return null;
          if (e.weight > 0) return ((e.weight / e.previousPR) - 1) * 100;
          return null;
        }).filter(v => v !== null);
        const avg = evos.length > 0 ? evos.reduce((a, b) => a + b, 0) / evos.length : 0;
        return { label: fmtLabel(s.date, period), evo: parseFloat(avg.toFixed(1)) };
      })
    : sessionsByMonth.map(({ label, sessions: ms }) => {
        const evos = ms.flatMap(s =>
          (s.entries || []).map(e => {
            if (!e.previousPR || e.previousPR === 0) return null;
            if (e.weight > 0) return ((e.weight / e.previousPR) - 1) * 100;
            return null;
          }).filter(v => v !== null)
        );
        const avg = evos.length > 0 ? evos.reduce((a, b) => a + b, 0) / evos.length : 0;
        return { label, evo: parseFloat(avg.toFixed(1)) };
      });

  // 9. Streak (dias de descanso não quebram — só falta em dia de rotina quebra)
  const streak = useMemo(() => {
    const sorted = [...sessions].sort((a, b) => new Date(a.date) - new Date(b.date));
    let maxStreak = 0, currentStreak = 0, prevDate = null;
    sorted.forEach((s) => {
      const d = new Date(s.date);
      d.setHours(0, 0, 0, 0);
      if (prevDate) {
        const diffDays = Math.round((d - prevDate) / (1000 * 60 * 60 * 24));
        if (diffDays === 0) {
          // mesma data, ignora
        } else {
          // verifica se algum dia de treino da rotina foi pulado entre as duas sessões
          let missedTraining = false;
          for (let i = 1; i < diffDays; i++) {
            const between = new Date(prevDate);
            between.setDate(between.getDate() + i);
            if (routineDows.has(between.getDay())) { missedTraining = true; break; }
          }
          if (missedTraining) currentStreak = 1;
          else currentStreak++;
        }
      } else {
        currentStreak = 1;
      }
      if (currentStreak > maxStreak) maxStreak = currentStreak;
      prevDate = d;
    });
    return maxStreak;
  }, [sessions, routineDows]);

  // 10. PRs do mês
  const prEntries = sessions.flatMap((s) =>
    (s.entries || []).filter((e) => e.hitPR).map((e) => ({
      machine: e.machine?.name, weight: e.weight, dayLabel: fmtLabel(s.date, period),
      previousPR: e.previousPR,
    }))
  );

  // Máquinas que têm pelo menos 1 entry registrada (para progressão)
  const machinesWithData = useMemo(() => {
    const ids = new Set();
    sessions.forEach((s) => (s.entries || []).forEach((e) => ids.add(e.machineId)));
    return machines.filter((m) => ids.has(m.id));
  }, [sessions, machines]);

  // Machine progression: 4 weeks (period=1) or by month (period>1)
  const progressChartData = useMemo(() => {
    if (!selectedMachine) return [];
    if (period === 1) {
      const weekMap = {};
      sessions.forEach((s) => {
        const entry = (s.entries || []).find(e => e.machineId === selectedMachine);
        if (!entry) return;
        const date = new Date(s.date);
        const week = Math.min(Math.ceil(date.getDate() / 7), 4);
        let maxReps = entry.reps || 0;
        let sd = entry.setsData;
        if (typeof sd === "string") { try { sd = JSON.parse(sd); } catch { sd = null; } }
        if (Array.isArray(sd)) {
          const real = sd.filter(x => !x.skipped);
          if (real.length > 0) maxReps = Math.max(...real.map(x => x.reps || 0));
        }
        if (!weekMap[week]) weekMap[week] = { weights: [], reps: [] };
        weekMap[week].weights.push(entry.weight);
        weekMap[week].reps.push(maxReps);
      });
      const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;
      const currentWeek = isCurrentMonth ? Math.min(Math.ceil(now.getDate() / 7), 4) : 5;
      return [1, 2, 3, 4]
        .filter(week => week < currentWeek)
        .map(week => {
          const d = weekMap[week];
          if (!d || d.weights.length === 0) return { semana: `Semana ${week}`, peso: null, reps: null, pesoLabel: "", repsLabel: "" };
          const maxPeso = Math.max(...d.weights);
          const avgReps = Math.round(d.reps.reduce((a, b) => a + b, 0) / d.reps.length);
          return { semana: `Semana ${week}`, peso: maxPeso, reps: avgReps, pesoLabel: `${maxPeso}kg`, repsLabel: `${avgReps}` };
        });
    }
    return sessionsByMonth.map(({ label, sessions: ms }) => {
      const entries = ms.flatMap(s => (s.entries || []).filter(e => e.machineId === selectedMachine));
      if (entries.length === 0) return { semana: label, peso: null, reps: null, pesoLabel: "", repsLabel: "" };
      const maxPeso = Math.max(...entries.map(e => e.weight));
      const avgReps = Math.round(entries.map(e => e.reps || 0).reduce((a, b) => a + b, 0) / entries.length);
      return { semana: label, peso: maxPeso, reps: avgReps, pesoLabel: `${maxPeso}kg`, repsLabel: `${avgReps}` };
    });
  }, [sessions, selectedMachine, period, sessionsByMonth]);

  const { pesoDomain, repsDomain, pesoTickAmount } = useMemo(() => {
    const pv = progressChartData.filter(d => d.peso !== null).map(d => d.peso);
    const rv = progressChartData.filter(d => d.reps !== null).map(d => d.reps);
    let pesoDomain = [0, 120], pesoTickAmount = 4;
    if (pv.length > 0) {
      const domMin = Math.max(0, Math.floor((Math.min(...pv) - 5) / 5) * 5);
      const domMax = Math.ceil((Math.max(...pv) + 5) / 5) * 5;
      const range = domMax - domMin;
      const step = range <= 25 ? 5 : range <= 60 ? 10 : 20;
      pesoDomain = [domMin, domMax];
      pesoTickAmount = range / step;
    }
    return {
      pesoDomain,
      pesoTickAmount,
      repsDomain: rv.length > 0 ? [Math.max(0, Math.min(...rv) - 6), Math.max(...rv) + 30] : [0, 20],
    };
  }, [progressChartData]);

  const bg = PAGE_BG;

  const dateLabel = period === 1
    ? `${MONTH_NAMES[month - 1]} ${year}`
    : monthRange[0][0] !== year
      ? `${MONTH_NAMES[monthRange[0][1] - 1]} ${monthRange[0][0]} – ${MONTH_NAMES[month - 1]} ${year}`
      : `${MONTH_NAMES[monthRange[0][1] - 1]} – ${MONTH_NAMES[month - 1]} ${year}`;

  return (
    <Box sx={{ minHeight: "100vh", pb: 10, background: bg }}>
      {/* Sticky date bar */}
      <Box sx={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        display: "flex", justifyContent: "center", alignItems: "center",
        py: 0.9,
        bgcolor: "rgba(10,18,40,0.92)",
        backdropFilter: "blur(10px)",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        transition: "transform 0.2s ease",
        transform: scrolled ? "translateY(0)" : "translateY(-100%)",
        pointerEvents: "none",
      }}>
        <Typography fontWeight={700} fontSize="0.85rem">{dateLabel}</Typography>
      </Box>
      <Container maxWidth="sm" sx={{ px: 2 }}>
        <Box sx={{ pt: 1.5, pb: 1, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Typography variant="h6" fontWeight={900}>Relatório</Typography>
          <IconButton onClick={openHistory} sx={{ color: "rgba(255,255,255,0.45)" }}>
            <HistoryIcon />
          </IconButton>
        </Box>

        {/* Month / range selector */}
        <Stack direction="row" alignItems="center" justifyContent="center" spacing={0.5} mb={2}>
          <IconButton onClick={prevMonth} sx={{ color: "rgba(255,255,255,0.5)" }}><ChevronLeftIcon /></IconButton>
          <Stack direction="row" alignItems="center" justifyContent="center" sx={{ minWidth: 160 }}>
            <Typography fontWeight={700} textAlign="center">{dateLabel}</Typography>
            <IconButton onClick={openRangePicker} size="small" sx={{ color: "rgba(255,255,255,0.35)", ml: 0.2 }}>
              <CalendarMonthIcon sx={{ fontSize: 15 }} />
            </IconButton>
          </Stack>
          <IconButton onClick={nextMonth} sx={{ color: "rgba(255,255,255,0.5)" }}><ChevronRightIcon /></IconButton>
        </Stack>

        {loading ? (
          <CircularProgress sx={{ display: "block", mx: "auto", mt: 4 }} />
        ) : !data || data.totalSessions === 0 ? (
          <Box textAlign="center" mt={4}>
            <FitnessCenterIcon sx={{ fontSize: 48, color: "rgba(255,255,255,0.15)", mb: 1 }} />
            <Typography color="text.secondary">Nenhum treino em {MONTH_FULL[month - 1]}.</Typography>
          </Box>
        ) : (
          <>
            {/* ── 10. Comparativo mês anterior ── */}
            <Stack direction="row" spacing={1} mb={1}>
              <Glass sx={{ flex: 1, p: 2, textAlign: "center" }}>
                <Typography variant="h4" fontWeight={900} color="primary">{data.totalSessions}</Typography>
                <Typography variant="body2" fontWeight={700}>Treinos</Typography>
              </Glass>
              <Glass sx={{ flex: 1, p: 2, textAlign: "center" }}>
                <Typography variant="h4" fontWeight={900} color="#facc15">{data.prsBeaten}</Typography>
                <Typography variant="body2" fontWeight={700}>PRs batidos</Typography>
              </Glass>
            </Stack>

            {/* 9. Streak + Duração */}
            <Stack direction="row" spacing={1} mb={2}>
              <Glass sx={{ flex: 1, p: 1.5, textAlign: "center" }}>
                <WhatshotIcon sx={{ color: "#f97316", fontSize: 20, mb: 0.3 }} />
                <Typography fontWeight={900} fontSize="1.3rem" color="#f97316">{streak}</Typography>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>Streak</Typography>
              </Glass>
              <Glass sx={{ flex: 1, p: 1.5, textAlign: "center" }}>
                <TimerIcon sx={{ color: "#60a5fa", fontSize: 20, mb: 0.3 }} />
                <Typography fontWeight={900} fontSize="1rem" color="#60a5fa">
                  {avgDuration > 0 ? `${avgDuration}min` : "—"}
                </Typography>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>Duração média</Typography>
              </Glass>
            </Stack>

            {/* ── 1b. Progressão de carga por máquina ── */}
            {machinesWithData.length > 0 && (() => {
              const validPts   = progressChartData.filter(d => d.peso !== null);
              const maxPeso    = validPts.length > 0 ? Math.max(...validPts.map(d => d.peso)) : null;
              const avgRepsVal = validPts.length > 0
                ? Math.round(validPts.reduce((a, d) => a + (d.reps || 0), 0) / validPts.length)
                : null;
              const firstPeso  = validPts.length > 0 ? validPts[0].peso : null;
              const lastPeso   = validPts.length > 0 ? validPts[validPts.length - 1].peso : null;
              const deltaKg    = firstPeso != null && lastPeso != null ? lastPeso - firstPeso : null;
              const deltaPct   = deltaKg != null && firstPeso > 0 ? ((deltaKg / firstPeso) * 100).toFixed(1) : null;
              return (
                <Glass sx={{ p: 2, mb: 2 }}>
                  <Box sx={{ textAlign: "center", mb: 1.5 }}>
                    <Typography fontWeight={800} fontSize="0.95rem" letterSpacing={0.2}>
                      {period === 1 ? "Progressão de carga" : "Média da progressão de carga"}
                    </Typography>
                  </Box>
                  <TextField select size="small" fullWidth value={selectedMachine}
                    onChange={(e) => setSelectedMachine(e.target.value)}
                    sx={{ mb: 1.5, "& .MuiOutlinedInput-root": { fontSize: "0.85rem" }, "& .MuiSelect-select": { textAlign: "center" } }}
                    SelectProps={{ MenuProps: { PaperProps: { sx: { maxHeight: 200 } } } }}>
                    {machinesWithData.map((m) => (
                      <MenuItem key={m.id} value={m.id} sx={{ fontSize: "0.85rem" }}>{m.name}</MenuItem>
                    ))}
                  </TextField>
                  {validPts.length > 0 ? (
                    <>
                      <Stack direction="row" spacing={1} mb={1.5} justifyContent="center">
                        <Box sx={{ flex: 1, textAlign: "center", py: 0.8, borderRadius: 2, bgcolor: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.2)" }}>
                          <Typography fontWeight={900} fontSize="1rem" color="#f97316">{maxPeso}kg</Typography>
                          <Typography fontSize="0.62rem" color="rgba(255,255,255,0.4)" fontWeight={600}>Máx. carga</Typography>
                        </Box>
                        <Box sx={{ flex: 1, textAlign: "center", py: 0.8, borderRadius: 2, bgcolor: "rgba(96,165,250,0.08)", border: "1px solid rgba(96,165,250,0.2)" }}>
                          <Typography fontWeight={900} fontSize="1rem" color="#60a5fa">{avgRepsVal ?? "—"}</Typography>
                          <Typography fontSize="0.62rem" color="rgba(255,255,255,0.4)" fontWeight={600}>Reps médias</Typography>
                        </Box>
                        <Box sx={{ flex: 1, textAlign: "center", py: 0.8, borderRadius: 2,
                          bgcolor: deltaPct == null ? "rgba(255,255,255,0.04)" : deltaKg >= 0 ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
                          border: `1px solid ${deltaPct == null ? "rgba(255,255,255,0.1)" : deltaKg >= 0 ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)"}`,
                        }}>
                          <Typography fontWeight={900} fontSize="1rem"
                            color={deltaPct == null ? "rgba(255,255,255,0.4)" : deltaKg >= 0 ? "#22c55e" : "#ef4444"}>
                            {deltaPct == null ? "—" : `${deltaKg >= 0 ? "+" : ""}${deltaPct}%`}
                          </Typography>
                          <Typography fontSize="0.62rem" color="rgba(255,255,255,0.4)" fontWeight={600}>Evolução</Typography>
                        </Box>
                      </Stack>
                      <ReactApexChart
                        type="area"
                        height={240}
                        series={[
                          { name: "Carga (kg)", data: progressChartData.map(d => d.peso) },
                          { name: "Reps", data: progressChartData.map(d => d.reps) },
                        ]}
                        options={{
                          chart: { background: "transparent", toolbar: { show: false }, fontFamily: "inherit", animations: { enabled: true, speed: 500, easing: "easeinout" }, zoom: { enabled: false }, offsetX: -10, dropShadow: { enabled: false } },
                          theme: { mode: "dark" },
                          colors: ["#f97316", "#60a5fa"],
                          fill: { type: ["gradient", "gradient"], gradient: { shade: "dark", type: "vertical", opacityFrom: 0.35, opacityTo: 0.02, stops: [0, 100] }, opacity: [1, 1] },
                          stroke: { curve: "smooth", width: [2.5, 2.5], dashArray: [0, 0] },
                          markers: { size: [5, 5], strokeWidth: 2, strokeColors: ["#111827", "#111827"], colors: ["#f97316", "#60a5fa"], hover: { size: 7 } },
                          xaxis: { categories: progressChartData.map(d => d.semana), labels: { style: { colors: "rgba(255,255,255,0.4)", fontSize: "10px", fontWeight: "600" }, offsetY: 2 }, axisBorder: { show: false }, axisTicks: { show: false }, tooltip: { enabled: false } },
                          yaxis: [
                            { seriesName: "Carga (kg)", min: pesoDomain[0], max: pesoDomain[1], tickAmount: pesoTickAmount, labels: { formatter: v => `${v}kg`, style: { colors: "rgba(255,255,255,0.7)", fontSize: "10px", fontWeight: "700" } } },
                            { seriesName: "Reps", show: false, min: repsDomain[0], max: repsDomain[1] },
                          ],
                          grid: { borderColor: "rgba(255,255,255,0.14)", strokeDashArray: 4, padding: { left: 34, right: 10, top: 0, bottom: 0 } },
                          annotations: {
                            xaxis: [],
                            points: progressChartData.filter(d => d.reps != null).map(d => ({
                              x: d.semana, y: d.reps, yAxisIndex: 1, marker: { size: 0 },
                              label: { text: `${d.reps}`, offsetY: 26, borderWidth: 0, borderRadius: 0, style: { background: "transparent", color: "#60a5fa", fontSize: "10px", fontWeight: "800", padding: { top: 0, bottom: 0, left: 0, right: 0 } } },
                            })),
                          },
                          dataLabels: { enabled: true, enabledOnSeries: [0], formatter: (val) => (val == null ? "" : `${val}kg`), style: { fontSize: "10px", fontWeight: "800", colors: ["#f97316"] }, background: { enabled: true, foreColor: "#111827", borderRadius: 3, padding: 3, opacity: 0.85, borderWidth: 0 }, offsetY: -8 },
                          legend: { position: "bottom", horizontalAlign: "center", labels: { colors: "rgba(255,255,255,0.55)" }, markers: { shape: "circle", size: 5 }, itemMargin: { horizontal: 10 }, fontSize: "11px", fontWeight: "700" },
                          tooltip: { theme: "dark", shared: true, intersect: false, y: [{ formatter: v => v != null ? `${v}kg` : "-" }, { formatter: v => v != null ? `${v} reps` : "-" }] },
                        }}
                      />
                    </>
                  ) : (
                    <Typography fontSize="0.82rem" color="text.secondary" textAlign="center" py={3}>
                      Sem dados para essa máquina neste mês.
                    </Typography>
                  )}
                </Glass>
              );
            })()}

            {/* ── 3. Frequência (heatmap — single month only) ── */}
            {period === 1 && <Glass sx={{ p: 2, mb: 2 }}>
              <Typography fontWeight={700} mb={1.5}>Frequência</Typography>
              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 0.5 }}>
                {DAYS.map((d) => (
                  <Typography key={d} fontSize="0.6rem" color="text.secondary" textAlign="center" fontWeight={700}>
                    {d}
                  </Typography>
                ))}
                {Array.from({ length: firstDow }).map((_, i) => (
                  <Box key={`e${i}`} />
                ))}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const trained = sessionDays.has(day);
                  const dayDate = new Date(year, month - 1, day);
                  const dow = dayDate.getDay();
                  const isRest = !routineDows.has(dow);
                  const isPast = dayDate <= now;
                  return (
                    <Box key={day} sx={{
                      aspectRatio: "1", borderRadius: 1, display: "flex", alignItems: "center", justifyContent: "center",
                      bgcolor: trained ? "rgba(34,197,94,0.3)" : isRest ? "rgba(255,255,255,0.03)" : isPast ? "rgba(239,68,68,0.08)" : "rgba(255,255,255,0.03)",
                      border: trained ? "1px solid rgba(34,197,94,0.5)" : "1px solid rgba(255,255,255,0.05)",
                    }}>
                      <Typography fontSize="0.65rem" fontWeight={trained ? 800 : 400}
                        color={trained ? "#22c55e" : isRest ? "rgba(255,255,255,0.2)" : isPast ? "rgba(239,68,68,0.4)" : "rgba(255,255,255,0.2)"}>
                        {day}
                      </Typography>
                    </Box>
                  );
                })}
              </Box>
              <Stack direction="row" spacing={2} mt={1.5} justifyContent="center">
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <Box sx={{ width: 10, height: 10, borderRadius: 0.5, bgcolor: "rgba(34,197,94,0.3)", border: "1px solid rgba(34,197,94,0.5)" }} />
                  <Typography fontSize="0.65rem" color="text.secondary">Treinou</Typography>
                </Stack>
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <Box sx={{ width: 10, height: 10, borderRadius: 0.5, bgcolor: "rgba(239,68,68,0.08)", border: "1px solid rgba(255,255,255,0.05)" }} />
                  <Typography fontSize="0.65rem" color="text.secondary">Faltou</Typography>
                </Stack>
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <Box sx={{ width: 10, height: 10, borderRadius: 0.5, bgcolor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }} />
                  <Typography fontSize="0.65rem" color="text.secondary">Descanso</Typography>
                </Stack>
              </Stack>
            </Glass>}


            {/* ── 5. Duração dos treinos ── */}
            {durationData.length > 0 && (
              <Glass sx={{ p: 2, mb: 2 }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1.5}>
                  <Typography fontWeight={700}>Duração (min)</Typography>
                  <Typography fontSize="0.75rem" color="text.secondary" fontWeight={600}>
                    média: {avgDuration}min
                  </Typography>
                </Stack>
                <ResponsiveContainer width="100%" height={130}>
                  <LineChart data={durationData}>
                    <XAxis dataKey="label" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <YAxis hide />
                    <Tooltip contentStyle={TT_STYLE} formatter={(v) => [`${v}min`, "Duração"]} />
                    <Line type="monotone" dataKey="minutos" stroke="#60a5fa" strokeWidth={2}
                      dot={{ r: 3, fill: "#60a5fa" }} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              </Glass>
            )}

            {/* ── 8. Evolução média por sessão ── */}
            {evoData.length > 0 && (
              <Glass sx={{ p: 2, mb: 2 }}>
                <Typography fontWeight={700} mb={1.5}>Evolução média por treino (%)</Typography>
                <ResponsiveContainer width="100%" height={130}>
                  <AreaChart data={evoData}>
                    <defs>
                      <linearGradient id="evoPos" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22c55e" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="label" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <YAxis hide />
                    <Tooltip contentStyle={TT_STYLE}
                      formatter={(v) => [`${v > 0 ? "+" : ""}${v}%`, "Evolução"]} />
                    <Area type="monotone" dataKey="evo" stroke="#22c55e" strokeWidth={2} fill="url(#evoPos)"
                      dot={(props) => {
                        const { cx, cy, payload } = props;
                        const c = payload.evo >= 0 ? "#22c55e" : "#ef4444";
                        return <circle key={props.key} cx={cx} cy={cy} r={3} fill={c} stroke="none" />;
                      }} />
                  </AreaChart>
                </ResponsiveContainer>
              </Glass>
            )}


            {/* ── 4. Distribuição muscular (pie) ── */}
            {categoryMap.length > 0 && (
              <Glass sx={{ p: 2, mb: 2 }}>
                <Typography fontWeight={700} mb={1}>Grupos musculares</Typography>
                <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                  <Box sx={{ width: 130, height: 130, flexShrink: 0 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={categoryMap} dataKey="value" cx="50%" cy="50%"
                          innerRadius={30} outerRadius={55} paddingAngle={2} strokeWidth={0}>
                          {categoryMap.map((entry, i) => (
                            <Cell key={i} fill={CATEGORY_COLOR[entry.name] || "#666"} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={TT_STYLE} />
                      </PieChart>
                    </ResponsiveContainer>
                  </Box>
                  <Stack spacing={0.4} sx={{ flex: 1 }}>
                    {categoryMap.map((cat) => (
                      <Stack key={cat.name} direction="row" alignItems="center" spacing={0.8}>
                        <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: CATEGORY_COLOR[cat.name] || "#666", flexShrink: 0 }} />
                        <Typography fontSize="0.75rem" fontWeight={600} sx={{ flex: 1 }}>{cat.name}</Typography>
                        <Typography fontSize="0.75rem" color="text.secondary" fontWeight={700}>{cat.value}</Typography>
                      </Stack>
                    ))}
                  </Stack>
                </Box>
              </Glass>
            )}



          </>
        )}
      </Container>

      {/* ── Month range picker ── */}
      <Dialog
        open={rangeOpen}
        onClose={closeRangePicker}
        fullWidth
        maxWidth="xs"
        PaperProps={{ sx: { bgcolor: "#071a12", backgroundImage: "none", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 2 } }}
      >
        <Box sx={{ px: 2.5, pt: 2, pb: 1, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Typography fontWeight={800} fontSize="0.9rem">
            {rangeStart ? "Clique no mês final" : "Clique no mês inicial"}
          </Typography>
          <IconButton size="small" onClick={closeRangePicker}><CloseIcon fontSize="small" /></IconButton>
        </Box>

        <DialogContent sx={{ px: 2, pb: 2.5, pt: 0.5 }}>
          {historyLoading && <Box textAlign="center" py={3}><CircularProgress size={22} sx={{ color: "#22c55e" }} /></Box>}

          {!historyLoading && (() => {
            const y = pickerYear;
            return (
              <Box>
                {/* Year navigator */}
                <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1.5}>
                  <IconButton
                    size="small"
                    disabled={y <= minPickerYear}
                    onClick={() => setPickerYear(v => v - 1)}
                    sx={{ color: y <= minPickerYear ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.6)" }}
                  >
                    <ChevronLeftIcon />
                  </IconButton>
                  <Typography fontWeight={800} fontSize="1rem">{y}</Typography>
                  <IconButton
                    size="small"
                    disabled={y >= now.getFullYear()}
                    onClick={() => setPickerYear(v => v + 1)}
                    sx={{ color: y >= now.getFullYear() ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.6)" }}
                  >
                    <ChevronRightIcon />
                  </IconButton>
                </Stack>

                {/* Month grid */}
                <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 0.8 }}>
                  {MONTH_NAMES.map((mn, mi) => {
                    const m = mi + 1;
                    const isFuture = y > now.getFullYear() || (y === now.getFullYear() && m > now.getMonth() + 1);
                    const hasData  = monthsWithData.has(`${y}-${m}`);
                    const key      = y * 12 + m;

                    const appliedStart = monthRange[0] ? monthRange[0][0] * 12 + monthRange[0][1] : null;
                    const appliedEnd   = year * 12 + month;
                    const sv = rangeStart ? rangeStart.year * 12 + rangeStart.month : null;
                    const hv = rangeHover ? rangeHover.year * 12 + rangeHover.month : null;

                    const isPickStart    = sv === key;
                    const inPreview      = sv !== null && hv !== null && key >= Math.min(sv, hv) && key <= Math.max(sv, hv);
                    const isAppliedStart = !rangeStart && appliedStart === key;
                    const isAppliedEnd   = !rangeStart && appliedEnd === key;
                    const inApplied      = !rangeStart && appliedStart !== null && key >= appliedStart && key <= appliedEnd;

                    const isEndpoint = isPickStart || isAppliedStart || isAppliedEnd;
                    const inRange    = inPreview || inApplied;

                    return (
                      <Box
                        key={m}
                        onClick={() => !isFuture && handleMonthClick(y, m)}
                        onMouseEnter={() => rangeStart && !isFuture && setRangeHover({ year: y, month: m })}
                        onMouseLeave={() => setRangeHover(null)}
                        sx={{
                          position: "relative",
                          py: 1.4, px: 0.5,
                          borderRadius: 1.5,
                          textAlign: "center",
                          cursor: isFuture ? "default" : "pointer",
                          bgcolor: isEndpoint ? "#22c55e" : inRange ? "rgba(34,197,94,0.15)" : "transparent",
                          border: isEndpoint ? "none" : hasData
                            ? "1px solid rgba(34,197,94,0.3)"
                            : "1px solid transparent",
                          opacity: isFuture ? 0.22 : 1,
                          transition: "background 0.12s",
                          "&:hover": !isFuture ? {
                            bgcolor: isEndpoint ? "#16a34a" : "rgba(34,197,94,0.22)",
                          } : {},
                        }}
                      >
                        <Typography
                          fontSize="0.85rem"
                          fontWeight={isEndpoint ? 900 : 600}
                          color={isEndpoint ? "#000" : hasData ? "#22c55e" : "rgba(255,255,255,0.55)"}
                        >
                          {mn}
                        </Typography>
                        {hasData && !isEndpoint && (
                          <Box sx={{
                            position: "absolute", bottom: 3, left: "50%",
                            transform: "translateX(-50%)",
                            width: 4, height: 4, borderRadius: "50%", bgcolor: "#22c55e",
                          }} />
                        )}
                      </Box>
                    );
                  })}
                </Box>
              </Box>
            );
          })()}

          <Stack direction="row" spacing={1} mt={0.5} justifyContent="flex-end">
            {period > 1 && !rangeStart && (
              <Box
                onClick={() => { setYear(now.getFullYear()); setMonth(now.getMonth() + 1); setPeriod(1); }}
                sx={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.4)", cursor: "pointer", "&:hover": { color: "rgba(255,255,255,0.7)" } }}
              >
                Limpar seleção
              </Box>
            )}
          </Stack>
        </DialogContent>
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
        machines={machines}
        onMachineCreated={(m) => setMachines((prev) => [...prev, m])}
      />

      <BottomNav />
    </Box>
  );
}
