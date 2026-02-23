import { useState, useEffect, useMemo } from "react";
import {
  Box, Typography, Stack, IconButton, CircularProgress, Chip, Container,
  MenuItem, TextField,
} from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import FitnessCenterIcon from "@mui/icons-material/FitnessCenter";
import TimerIcon from "@mui/icons-material/Timer";
import WhatshotIcon from "@mui/icons-material/Whatshot";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend,
  LineChart, Line, AreaChart, Area, PieChart, Pie, LabelList, CartesianGrid,
} from "recharts";
import api from "../utils/api.js";
import Glass from "../components/Glass.jsx";
import BottomNav from "../components/BottomNav.jsx";
import { PAGE_BG } from "../constants/theme.js";
import { CATEGORY_COLOR } from "../constants/categories.js";

const MONTH_NAMES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const MONTH_FULL = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const DAYS = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];

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
  const [data, setData] = useState(null);
  const [prevData, setPrevData] = useState(null);
  const [routine, setRoutine] = useState([]);
  const [machines, setMachines] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedMachine, setSelectedMachine] = useState("");

  useEffect(() => {
    setLoading(true);
    const prevM = month === 1 ? 12 : month - 1;
    const prevY = month === 1 ? year - 1 : year;
    Promise.all([
      api.get(`/sessions/report/${year}/${month}`),
      api.get(`/sessions/report/${prevY}/${prevM}`),
      api.get("/routine"),
      api.get("/machines"),
    ]).then(([r, pr, rt, mc]) => {
      setData(r.data);
      setPrevData(pr.data);
      setRoutine(rt.data);
      setMachines(mc.data);
      // Seleciona a primeira máquina com entries no mês
      const entryMachineIds = new Set();
      (r.data.sessions || []).forEach((s) => (s.entries || []).forEach((e) => entryMachineIds.add(e.machineId)));
      const firstWithData = mc.data.find((m) => entryMachineIds.has(m.id));
      if (firstWithData) setSelectedMachine(firstWithData.id);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [year, month]);

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12); } else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1); } else setMonth(m => m + 1);
  }

  // ── Derived data ──

  const sessions = data?.sessions || [];
  const prevSessions = prevData?.sessions || [];

  // 1. Exercícios por treino (já existia)
  const chartData = sessions.map((s) => ({
    day: new Date(s.date).getDate(),
    exercicios: s.entries?.length || 0,
    rating: s.dayRating || 0,
  }));

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
  const durationData = sessions.filter(s => s.duration > 0).map((s) => ({
    day: new Date(s.date).getDate(),
    minutos: Math.round(s.duration / 60),
  }));
  const avgDuration = durationData.length > 0
    ? Math.round(durationData.reduce((s, d) => s + d.minutos, 0) / durationData.length)
    : 0;
  const prevDurations = prevSessions.filter(s => s.duration > 0);
  const prevAvgDuration = prevDurations.length > 0
    ? Math.round(prevDurations.reduce((s, d) => s + d.duration / 60, 0) / prevDurations.length)
    : 0;

  // 6. Taxa de completude
  const completudeData = sessions.map((s) => {
    const dow = new Date(s.date).getDay();
    const dayRoutine = routine.find(r => r.dayOfWeek === dow);
    const programmed = dayRoutine?.exercises?.length || 0;
    const done = s.entries?.length || 0;
    return {
      day: new Date(s.date).getDate(),
      feitos: done,
      faltaram: Math.max(0, programmed - done),
      pct: programmed > 0 ? Math.round((done / programmed) * 100) : 100,
    };
  });
  const avgCompletude = completudeData.length > 0
    ? Math.round(completudeData.reduce((s, d) => s + d.pct, 0) / completudeData.length)
    : 0;

  // 7. Top máquinas
  const topMachines = useMemo(() => {
    const map = {};
    sessions.forEach((s) => {
      (s.entries || []).forEach((e) => {
        if (!map[e.machineId]) map[e.machineId] = { name: e.machine?.name || "?", category: e.machine?.category || "", count: 0, prs: 0, maxWeight: 0 };
        map[e.machineId].count++;
        if (e.hitPR) map[e.machineId].prs++;
        if (e.weight > map[e.machineId].maxWeight) map[e.machineId].maxWeight = e.weight;
      });
    });
    return Object.values(map).sort((a, b) => b.count - a.count).slice(0, 5);
  }, [sessions]);

  // 8. Evolução média por sessão
  const evoData = sessions.map((s) => {
    const evos = (s.entries || []).map((e) => {
      if (!e.previousPR || e.previousPR === 0) return null;
      if (e.weight > 0) return ((e.weight / e.previousPR) - 1) * 100;
      return null;
    }).filter(v => v !== null);
    const avg = evos.length > 0 ? evos.reduce((a, b) => a + b, 0) / evos.length : 0;
    return { day: new Date(s.date).getDate(), evo: parseFloat(avg.toFixed(1)) };
  });

  // 9. Streak
  const streak = useMemo(() => {
    const sorted = [...sessions].sort((a, b) => new Date(a.date) - new Date(b.date));
    let maxStreak = 0, currentStreak = 0, prevDate = null;
    sorted.forEach((s) => {
      const d = new Date(s.date);
      d.setHours(0, 0, 0, 0);
      if (prevDate) {
        const diff = (d - prevDate) / (1000 * 60 * 60 * 24);
        if (diff === 1) currentStreak++;
        else if (diff > 1) currentStreak = 1;
      } else {
        currentStreak = 1;
      }
      if (currentStreak > maxStreak) maxStreak = currentStreak;
      prevDate = d;
    });
    return maxStreak;
  }, [sessions]);

  // 10. PRs do mês
  const prEntries = sessions.flatMap((s) =>
    (s.entries || []).filter((e) => e.hitPR).map((e) => ({
      machine: e.machine?.name, weight: e.weight, day: new Date(s.date).getDate(),
      previousPR: e.previousPR,
    }))
  );

  // Máquinas que têm pelo menos 1 entry registrada (para progressão)
  const machinesWithData = useMemo(() => {
    const ids = new Set();
    sessions.forEach((s) => (s.entries || []).forEach((e) => ids.add(e.machineId)));
    return machines.filter((m) => ids.has(m.id));
  }, [sessions, machines]);

  // Machine progression: always 4 weeks, null for missing weeks
  const progressChartData = useMemo(() => {
    if (!selectedMachine) return [];
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
    return [1, 2, 3, 4].map(week => {
      const d = weekMap[week];
      if (!d || d.weights.length === 0) return { semana: `Semana ${week}`, peso: null, reps: null, pesoLabel: "", repsLabel: "" };
      const maxPeso = Math.max(...d.weights);
      const avgReps = Math.round(d.reps.reduce((a, b) => a + b, 0) / d.reps.length);
      return { semana: `Semana ${week}`, peso: maxPeso, reps: avgReps, pesoLabel: `${maxPeso}kg`, repsLabel: `${avgReps}` };
    });
  }, [sessions, selectedMachine]);

  const { pesoDomain, repsDomain } = useMemo(() => {
    const pv = progressChartData.filter(d => d.peso !== null).map(d => d.peso);
    const rv = progressChartData.filter(d => d.reps !== null).map(d => d.reps);
    return {
      pesoDomain: pv.length > 0 ? [Math.max(0, Math.min(...pv) - 30), Math.max(...pv) + 8] : [0, 120],
      repsDomain: rv.length > 0 ? [Math.max(0, Math.min(...rv) - 6), Math.max(...rv) + 30] : [0, 20],
    };
  }, [progressChartData]);

  const bg = PAGE_BG;

  return (
    <Box sx={{ minHeight: "100vh", pb: 10, background: bg }}>
      <Container maxWidth="sm" sx={{ px: 2 }}>
        <Box sx={{ pt: 5, pb: 1 }}>
          <Typography variant="h6" fontWeight={900}>Relatório</Typography>
        </Box>

        {/* Month selector */}
        <Stack direction="row" alignItems="center" justifyContent="center" spacing={1} mb={2}>
          <IconButton onClick={prevMonth} sx={{ color: "rgba(255,255,255,0.5)" }}><ChevronLeftIcon /></IconButton>
          <Typography fontWeight={700} minWidth={120} textAlign="center">{MONTH_NAMES[month - 1]} {year}</Typography>
          <IconButton onClick={nextMonth} sx={{ color: "rgba(255,255,255,0.5)" }}><ChevronRightIcon /></IconButton>
        </Stack>

        {loading ? (
          <CircularProgress sx={{ display: "block", mx: "auto", mt: 4 }} />
        ) : data?.totalSessions === 0 ? (
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
                <CompareChip current={data.totalSessions} previous={prevData?.totalSessions} />
              </Glass>
              <Glass sx={{ flex: 1, p: 2, textAlign: "center" }}>
                <Typography variant="h4" fontWeight={900} color="#facc15">{data.prsBeaten}</Typography>
                <Typography variant="body2" fontWeight={700}>PRs batidos</Typography>
                <CompareChip current={data.prsBeaten} previous={prevData?.prsBeaten} />
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
                <CompareChip current={avgDuration} previous={prevAvgDuration} invert />
              </Glass>
            </Stack>

            {/* ── 3. Frequência (heatmap) ── */}
            <Glass sx={{ p: 2, mb: 2 }}>
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
            </Glass>

            {/* ── 1. Exercícios por treino (existente) ── */}
            {chartData.length > 0 && (
              <Glass sx={{ p: 2, mb: 2 }}>
                <Typography fontWeight={700} mb={1.5}>Exercícios por treino</Typography>
                <ResponsiveContainer width="100%" height={130}>
                  <BarChart data={chartData} barSize={14}>
                    <XAxis dataKey="day" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={TT_STYLE} labelFormatter={(v) => `Dia ${v}`} />
                    <Bar dataKey="exercicios" name="Exercícios" radius={[4, 4, 0, 0]}>
                      {chartData.map((entry, i) => (
                        <Cell key={i} fill={entry.rating === 3 ? "#22c55e" : entry.rating === 1 ? "#ef4444" : "rgba(255,255,255,0.2)"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Glass>
            )}

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
                    <XAxis dataKey="day" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis hide />
                    <Tooltip contentStyle={TT_STYLE} labelFormatter={(v) => `Dia ${v}`}
                      formatter={(v) => [`${v}min`, "Duração"]} />
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
                    <XAxis dataKey="day" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis hide />
                    <Tooltip contentStyle={TT_STYLE} labelFormatter={(v) => `Dia ${v}`}
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

            {/* ── 6. Taxa de completude ── */}
            {completudeData.length > 0 && (
              <Glass sx={{ p: 2, mb: 2 }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1.5}>
                  <Typography fontWeight={700}>Completude</Typography>
                  <Chip label={`${avgCompletude}%`} size="small" sx={{
                    bgcolor: avgCompletude >= 90 ? "rgba(34,197,94,0.15)" : avgCompletude >= 70 ? "rgba(250,204,21,0.15)" : "rgba(239,68,68,0.15)",
                    color: avgCompletude >= 90 ? "#22c55e" : avgCompletude >= 70 ? "#facc15" : "#ef4444",
                    fontWeight: 800,
                  }} />
                </Stack>
                <ResponsiveContainer width="100%" height={130}>
                  <BarChart data={completudeData} barSize={14}>
                    <XAxis dataKey="day" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={TT_STYLE} labelFormatter={(v) => `Dia ${v}`} />
                    <Bar dataKey="feitos" name="Feitos" stackId="a" fill="#22c55e" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="faltaram" name="Faltaram" stackId="a" fill="rgba(239,68,68,0.3)" radius={[4, 4, 0, 0]} />
                  </BarChart>
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

            {/* ── 1b. Progressão de carga por máquina ── */}
            {machinesWithData.length > 0 && (
              <Glass sx={{ p: 2, mb: 2 }}>
                <Typography fontWeight={700} mb={1}>Progressão de carga</Typography>
                <TextField select size="small" fullWidth value={selectedMachine}
                  onChange={(e) => setSelectedMachine(e.target.value)}
                  sx={{ mb: 1.5, "& .MuiOutlinedInput-root": { fontSize: "0.85rem" } }}
                  SelectProps={{ MenuProps: { PaperProps: { sx: { maxHeight: 200 } } } }}>
                  {machinesWithData.map((m) => (
                    <MenuItem key={m.id} value={m.id} sx={{ fontSize: "0.85rem" }}>
                      {m.name} {m.currentPR ? `(${m.currentPR}kg)` : ""}
                    </MenuItem>
                  ))}
                </TextField>
                {progressChartData.some(d => d.peso !== null) ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={progressChartData} margin={{ top: 32, right: 24, left: 24, bottom: 32 }}>
                      <CartesianGrid strokeDasharray="4 4" stroke="rgba(255,255,255,0.09)" />
                      <XAxis dataKey="semana" tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} />
                      <YAxis yAxisId="peso" domain={pesoDomain} tickCount={6}
                        tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 9 }} axisLine={false} tickLine={false}
                        tickFormatter={(v) => `${v}kg`} width={36} />
                      <YAxis yAxisId="reps" orientation="right" hide domain={repsDomain} />
                      <Tooltip contentStyle={TT_STYLE}
                        formatter={(v, name) => name === "Carga (kg)" ? [`${v}kg`, name] : [v, name]} />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
                      <Line yAxisId="peso" type="monotone" dataKey="peso" name="Carga (kg)" stroke="#f97316"
                        strokeWidth={1.5} strokeDasharray="5 5" connectNulls={false}
                        dot={{ r: 4, fill: "#f97316", stroke: "#1a1a2e", strokeWidth: 2 }} activeDot={{ r: 6 }}>
                        <LabelList dataKey="pesoLabel" position="top" style={{ fill: "#f97316", fontSize: 11, fontWeight: 800 }} offset={10} />
                      </Line>
                      <Line yAxisId="reps" type="monotone" dataKey="reps" name="Repetições" stroke="#60a5fa"
                        strokeWidth={1.5} strokeDasharray="5 5" connectNulls={false}
                        dot={{ r: 4, fill: "#60a5fa", stroke: "#1a1a2e", strokeWidth: 2 }} activeDot={{ r: 6 }}>
                        <LabelList dataKey="repsLabel" position="bottom" style={{ fill: "#60a5fa", fontSize: 11, fontWeight: 800 }} offset={10} />
                      </Line>
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <Typography fontSize="0.82rem" color="text.secondary" textAlign="center" py={3}>
                    Sem dados para essa máquina neste mês.
                  </Typography>
                )}
              </Glass>
            )}

            {/* ── 7. Volume ── */}
            {topMachines.length > 0 && (
              <Glass sx={{ p: 2, mb: 2 }}>
                <Typography fontWeight={700} mb={1.5}>Volume</Typography>
                <Stack spacing={0.8}>
                  {topMachines.map((m, i) => (
                    <Stack key={i} direction="row" alignItems="center" spacing={1.5}>
                      <Typography fontWeight={900} fontSize="1.1rem" color={i === 0 ? "#22c55e" : i === 1 ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.35)"}
                        sx={{ width: 22, textAlign: "center" }}>
                        {i + 1}
                      </Typography>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography fontWeight={700} fontSize="0.88rem" noWrap>{m.name}</Typography>
                        <Typography fontSize="0.7rem" color="text.secondary">{m.category}</Typography>
                      </Box>
                      <Stack direction="row" spacing={0.5} alignItems="center" sx={{ flexShrink: 0 }}>
                        <Chip label={`${m.count}x`} size="small" sx={{ height: 22, fontSize: "0.7rem", fontWeight: 700,
                          bgcolor: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)" }} />
                        <Typography fontSize="0.75rem" color="text.secondary" fontWeight={600}>
                          {m.maxWeight}kg
                        </Typography>
                      </Stack>
                    </Stack>
                  ))}
                </Stack>
              </Glass>
            )}

            {/* ── PRs batidos ── */}
            {prEntries.length > 0 && (
              <Glass sx={{ p: 2, mb: 2 }}>
                <Stack direction="row" alignItems="center" spacing={1} mb={1.5}>
                  <EmojiEventsIcon sx={{ color: "#facc15", fontSize: 18 }} />
                  <Typography fontWeight={700}>PRs batidos</Typography>
                </Stack>
                <Stack spacing={0.8}>
                  {prEntries.map((pr, i) => (
                    <Stack key={i} direction="row" alignItems="center" justifyContent="space-between">
                      <Typography variant="body2" fontWeight={600}>{pr.machine}</Typography>
                      <Stack direction="row" spacing={1} alignItems="center">
                        {pr.previousPR > 0 && (
                          <Typography fontSize="0.72rem" color="text.secondary" sx={{ textDecoration: "line-through" }}>
                            {pr.previousPR}kg
                          </Typography>
                        )}
                        <Chip label={`${pr.weight}kg`} size="small"
                          sx={{ bgcolor: "rgba(250,204,21,0.1)", color: "#facc15", border: "1px solid rgba(250,204,21,0.3)", fontWeight: 700 }} />
                        <Typography variant="caption" color="text.secondary">dia {pr.day}</Typography>
                      </Stack>
                    </Stack>
                  ))}
                </Stack>
              </Glass>
            )}
          </>
        )}
      </Container>

      <BottomNav />
    </Box>
  );
}
