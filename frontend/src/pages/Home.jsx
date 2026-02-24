import { useState, useEffect, useRef, useMemo } from "react";

// Persiste durante navegação SPA, mas reseta no F5 ou ao fechar/reabrir o app
let promptDismissed = false;
import {
  Box, Typography, Button, Stack, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions,
  IconButton, List, ListItem, ListItemText, ListItemSecondaryAction,
  TextField, MenuItem, Divider, Chip,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import WifiOffIcon from "@mui/icons-material/WifiOff";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import FitnessCenterIcon from "@mui/icons-material/FitnessCenter";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import StarIcon from "@mui/icons-material/Star";
import LogoutIcon from "@mui/icons-material/Logout";
import SettingsIcon from "@mui/icons-material/Settings";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import PeopleAltIcon from "@mui/icons-material/PeopleAlt";
import { BarChart, Bar, Cell, XAxis } from "recharts";
import { useNavigate } from "react-router-dom";
import api from "../utils/api.js";
import { removeToken } from "../utils/authStorage.js";
import { getSimDay, getSimDayOffset, advanceSimDay, resetSimDay } from "../utils/simDay.js";
import {
  syncPending, cacheAllRoutine, getCachedAllRoutine,
  cacheMachines, getCachedMachines, cacheUser, getCachedUser,
  saveOfflineSession,
} from "../utils/offlineQueue.js";
import BottomNav from "../components/BottomNav.jsx";
import { DAYS, MONTHS } from "../constants/dateLabels.js";
import { PAGE_BG } from "../constants/theme.js";
import { CATEGORIES } from "../constants/categories.js";

function getGreeting() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "Bom dia";
  if (h >= 12 && h < 18) return "Boa tarde";
  return "Boa noite";
}

function Avatar({ user, size = 40, onClick }) {
  const initials = user?.name ? user.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase() : "?";
  return (
    <Box
      onClick={onClick}
      sx={{
        width: size, height: size, borderRadius: "50%",
        overflow: "hidden", flexShrink: 0, cursor: onClick ? "pointer" : "default",
        border: "2px solid rgba(34,197,94,0.4)",
        display: "flex", alignItems: "center", justifyContent: "center",
        bgcolor: "rgba(34,197,94,0.15)",
        "&:active": onClick ? { opacity: 0.7 } : {},
      }}
    >
      {user?.photoBase64 ? (
        <Box component="img" src={user.photoBase64} sx={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <Typography fontSize={size * 0.35} fontWeight={800} color="#22c55e">{initials}</Typography>
      )}
    </Box>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const today = new Date();
  const dow = getSimDay();
  const fileRef = useRef();
  const carouselRef = useRef(null);

  // Inicializar do cache — evita spinner na primeira renderização
  const [loading, setLoading] = useState(() => {
    const r = getCachedAllRoutine(); const m = getCachedMachines();
    return r.length === 0 && m.length === 0 && !getCachedUser();
  });
  const [user, setUser] = useState(() => getCachedUser());
  const [status, setStatus] = useState(null);
  const [session, setSession] = useState(null);
  const [report, setReport] = useState(null);
  const [routine, setRoutine] = useState(() => getCachedAllRoutine());
  const [machines, setMachines] = useState(() => getCachedMachines());

  const [isOffline, setIsOffline] = useState(false);
  const [showOfflineBanner, setShowOfflineBanner] = useState(false);
  const [syncOk, setSyncOk] = useState(false);
  const [showSyncText, setShowSyncText] = useState(false);
  const [syncCount, setSyncCount] = useState(0);
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [starting, setStarting] = useState(false);

  // Config dialog
  const [configOpen, setConfigOpen] = useState(false);
  const [simOffset, setSimOffset] = useState(getSimDayOffset());
  const [savingPhoto, setSavingPhoto] = useState(false);

  // Routine edit
  const [editDow, setEditDow] = useState(null);
  const [editExercises, setEditExercises] = useState([]);
  const [addOpen, setAddOpen] = useState(false);
  const [addMachineId, setAddMachineId] = useState("");
  const [addSets, setAddSets] = useState("2");
  const [addReps, setAddReps] = useState("6");
  const [saving, setSaving] = useState(false);
  // Add dialog — search + category + inline create
  const [addSearch, setAddSearch] = useState("");
  const [addCatFilter, setAddCatFilter] = useState(null);
  const [addCreateMode, setAddCreateMode] = useState(false);
  const [addNewName, setAddNewName] = useState("");
  const [addNewCat, setAddNewCat] = useState("");
  const [creatingMachine, setCreatingMachine] = useState(false);

  useEffect(() => {
    async function load() {
      const year = today.getFullYear();
      const month = today.getMonth() + 1;

      // Sync offline sessions em paralelo — não bloqueia o carregamento da UI
      syncPending().catch(() => {});

      try {
        const isSim = getSimDayOffset() > 0;
        const [stRes, sesRes, repRes, routineRes, machinesRes, userRes] = await Promise.all([
          api.get("/sessions/status"),
          isSim ? Promise.resolve({ data: null }) : api.get("/sessions/today"),
          api.get(`/sessions/report/${year}/${month}`),
          api.get("/routine"),
          api.get("/machines"),
          api.get("/users/me"),
        ]);
        setStatus(stRes.data);
        // Simulação: sessão vem do localStorage, não do backend
        if (isSim) {
          const simKey = `dg_sim_session_${getSimDayOffset()}`;
          const storedSim = localStorage.getItem(simKey);
          setSession(storedSim ? JSON.parse(storedSim) : null);
        } else {
          setSession(sesRes.data);
        }
        setReport(repRes.data);
        setRoutine(routineRes.data);
        setMachines(machinesRes.data);
        setUser(userRes.data);
        // Cache for offline use
        cacheAllRoutine(routineRes.data);
        cacheMachines(machinesRes.data);
        cacheUser(userRes.data);
        setLoading(false);
      } catch {
        // Server unreachable — use cached data
        setIsOffline(true);
        setShowOfflineBanner(true);
        const cachedRoutine  = getCachedAllRoutine();
        const cachedMachines = getCachedMachines();
        const cachedUser     = getCachedUser();
        setRoutine(cachedRoutine);
        setMachines(cachedMachines);
        if (cachedUser) setUser(cachedUser);
        setStatus({ hasMachines: cachedMachines.length > 0, hasRoutine: cachedRoutine.length > 0 });
        setLoading(false);
      }
    }
    load();

    // When connectivity is restored mid-session, sync and show success indicator
    async function handleOnline() {
      try {
        const n = await syncPending();
        if (n > 0) {
          setSyncCount(n);
          setSyncOk(true);
          setShowSyncText(true);
          setTimeout(() => setShowSyncText(false), 3500);
        }
      } catch {}
    }
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, []);

  useEffect(() => {
    if (!carouselRef.current || dow === 0) return;
    const cardWidth = window.innerWidth * 0.58 + 12; // 58vw + gap(1.5*8px)
    carouselRef.current.scrollLeft = dow * cardWidth;
  }, [loading]);

  async function startWorkout() {
    promptDismissed = true;
    setStarting(true);
    // Simulação: não cria sessão no backend, Treino.jsx cuida disso localmente
    if (getSimDayOffset() > 0) {
      navigate("/app/treino");
      return;
    }
    try {
      await api.post("/sessions");
      navigate("/app/treino");
    } catch {
      saveOfflineSession({ id: "offline", date: new Date().toISOString(), entries: [], finished: false });
      navigate("/app/treino");
    }
  }

  function handlePhotoChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      setSavingPhoto(true);
      const r = await api.patch("/users/me", { photoBase64: ev.target.result });
      setUser(r.data);
      setSavingPhoto(false);
    };
    reader.readAsDataURL(file);
  }

  function handleAdvanceDay() {
    advanceSimDay();
    window.location.reload();
  }

  async function handleResetDay() {
    resetSimDay();
    // Limpa todas as chaves de simulação (qualquer data)
    Object.keys(localStorage)
      .filter((k) => k.startsWith("dg_today_ex_") || k.startsWith("dg_skip_") || k.startsWith("dg_sim_session_"))
      .forEach((k) => localStorage.removeItem(k));
    localStorage.removeItem("dg_offline_session");
    localStorage.removeItem("dg_pending_sessions");
    // Deleta sessão de hoje do servidor (sessão de teste)
    try { await api.delete("/sessions/today"); } catch {}
    window.location.reload();
  }

  // Filter sessions to only those up to (and including) today
  const todayEnd = new Date(today);
  todayEnd.setHours(23, 59, 59, 999);
  const sessionsUpToToday = report?.sessions?.filter((s) => new Date(s.date) <= todayEnd) || [];

  // Chart: sessions per weekday this month (only up to today)
  const chartData = DAYS.map((label, d) => ({
    day: label,
    val: sessionsUpToToday.filter((s) => new Date(s.date).getDay() === d).length || 0,
  }));

  // Routine edit helpers
  function openEditDay(d) {
    const existing = routine.find((r) => r.dayOfWeek === d);
    setEditDow(d);
    setEditExercises(
      existing?.exercises?.map((e) => ({
        machineId: e.machine.id, machineName: e.machine.name, sets: e.sets, reps: e.reps,
      })) || []
    );
  }

  function resetAddDialog() {
    setAddMachineId(""); setAddSets("2"); setAddReps("6");
    setAddSearch(""); setAddCatFilter(null);
    setAddCreateMode(false); setAddNewName(""); setAddNewCat("");
  }

  function addExercise() {
    const machine = machines.find((m) => m.id === addMachineId);
    if (!machine) return;
    setEditExercises((prev) => [
      ...prev,
      { machineId: machine.id, machineName: machine.name, sets: parseInt(addSets) || 2, reps: parseInt(addReps) || 6 },
    ]);
    setAddOpen(false); resetAddDialog();
  }

  async function handleCreateAndAddMachine() {
    if (!addNewName || !addNewCat) return;
    setCreatingMachine(true);
    try {
      const res = await api.post("/machines", { name: addNewName.trim(), category: addNewCat });
      const newMachine = res.data;
      setMachines((prev) => [...prev, newMachine]);
      setAddMachineId(newMachine.id);
      setAddCreateMode(false); setAddNewName(""); setAddNewCat("");
      setAddCatFilter(null); setAddSearch("");
    } finally {
      setCreatingMachine(false);
    }
  }

  async function saveDay() {
    setSaving(true);
    const r = await api.put(`/routine/day/${editDow}`, {
      exercises: editExercises.map((e) => ({ machineId: e.machineId, sets: e.sets, reps: e.reps })),
    });
    setRoutine((prev) => {
      const without = prev.filter((d) => d.dayOfWeek !== editDow);
      if (r.data?.id) return [...without, r.data].sort((a, b) => a.dayOfWeek - b.dayOfWeek);
      return without;
    });
    setSaving(false); setEditDow(null);
  }

  const filteredAddMachines = useMemo(() => {
    return machines.filter((m) => {
      const matchCat = !addCatFilter || m.category === addCatFilter;
      const matchSearch = !addSearch || m.name.toLowerCase().includes(addSearch.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [machines, addCatFilter, addSearch]);

  const bg = PAGE_BG;

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh" sx={{ background: bg }}>
        <CircularProgress color="primary" />
      </Box>
    );
  }

  const totalSessions = sessionsUpToToday.length;
  const prsBeaten = sessionsUpToToday.flatMap((s) => s.entries || []).filter((e) => e.hitPR).length;
  const avgRating = report?.avgDayRating || 0;
  const ratingLabel = avgRating >= 2.5 ? "Top" : avgRating >= 1.5 ? "Normal" : avgRating > 0 ? "Ruim" : "—";
  const simDayLabel = DAYS[dow];

  return (
    <Box sx={{ minHeight: "100vh", pb: 10, background: bg }}>
      {/* Header */}
      <Box sx={{ pt: 5, pb: 2, px: 2.5, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Avatar user={user} size={52} onClick={() => setConfigOpen(true)} />
          <Box>
            <Typography variant="body2" color="text.secondary" lineHeight={1.2}>
              {DAYS[today.getDay()]}, {today.getDate()} de {MONTHS[today.getMonth()]}
              {simOffset > 0 && (
                <Typography component="span" sx={{ ml: 0.5, color: "#facc15", fontSize: "0.7rem", fontWeight: 700 }}>
                  [{simDayLabel}]
                </Typography>
              )}
            </Typography>
            <Typography variant="h6" fontWeight={900} lineHeight={1.2}>
              {getGreeting()}{user?.name ? `, ${user.name.split(" ")[0]}` : ""}
            </Typography>
          </Box>
        </Stack>
        <Stack direction="row" alignItems="center">
          {/* Sync success indicator */}
          {syncOk && (
            <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mr: 0.5 }}>
              <Box sx={{
                overflow: "hidden",
                maxWidth: showSyncText ? "180px" : "0px",
                transition: "max-width 0.6s ease",
                whiteSpace: "nowrap",
              }}>
                <Typography variant="caption" color="#22c55e" fontWeight={700}>
                  Sincronizado!
                </Typography>
              </Box>
              <IconButton size="small" onClick={() => setSyncDialogOpen(true)}
                sx={{ color: "#22c55e", p: 0.5 }}>
                <CheckCircleIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Stack>
          )}
          <IconButton size="small" sx={{ color: "rgba(255,255,255,0.4)" }} onClick={() => setConfigOpen(true)}>
            <SettingsIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" sx={{ color: "rgba(255,255,255,0.25)" }}
            onClick={() => { removeToken(); navigate("/login", { replace: true }); }}>
            <LogoutIcon fontSize="small" />
          </IconButton>
        </Stack>
      </Box>

      <Box sx={{ px: 2 }}>
        {/* Offline banner */}
        {showOfflineBanner && (
          <Box sx={{ mb: 2, borderRadius: 2.5, overflow: "hidden",
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

        {/* Big stats card */}
        <Box sx={{ mb: 1.5, p: 2.5, borderRadius: 3, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <Typography variant="caption" color="text.secondary" fontWeight={600} letterSpacing={0.5}>
            TREINOS ESTE MÊS
          </Typography>
          <Stack direction="row" alignItems="flex-end" justifyContent="space-between">
            <Box>
              <Typography variant="h2" fontWeight={900} lineHeight={1} color="#EAF0FF">{totalSessions}</Typography>
              <Typography variant="body2" color="text.secondary" mt={0.5}>sessões registradas</Typography>
            </Box>
            <Box sx={{ width: 120, height: 60, flexShrink: 0 }}>
              <BarChart width={120} height={60} data={chartData} barSize={10} margin={{ top: 0, bottom: 0, left: 0, right: 0 }}>
                <XAxis dataKey="day" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 9 }} axisLine={false} tickLine={false} />
                <Bar dataKey="val" radius={[3, 3, 0, 0]}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={i === dow ? "#22c55e" : entry.val > 0 ? "rgba(34,197,94,0.4)" : "rgba(255,255,255,0.08)"} />
                  ))}
                </Bar>
              </BarChart>
            </Box>
          </Stack>
        </Box>

        {/* PRs card */}
        <Box sx={{ mb: 2.5, p: 2, borderRadius: 3, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)", alignSelf: "flex-start" }}>
          <Stack direction="row" alignItems="center" spacing={0.8} mb={0.5}>
            <EmojiEventsIcon sx={{ color: "#facc15", fontSize: 16 }} />
            <Typography variant="caption" color="text.secondary" fontWeight={600}>PRs</Typography>
          </Stack>
          <Typography variant="h4" fontWeight={900} color="#facc15">{prsBeaten}</Typography>
          <Typography variant="caption" color="text.secondary">batidos</Typography>
        </Box>

        {/* Rotina da semana */}
        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1.5}>
          <Typography fontWeight={800} fontSize="1rem">Rotina da semana</Typography>
          <Typography variant="caption" color="primary" sx={{ cursor: "pointer" }} onClick={() => navigate("/app/rotina")}>
            Ver tudo →
          </Typography>
        </Stack>
      </Box>

      {/* Horizontal scroll days */}
      <Box ref={carouselRef} data-no-swipe sx={{ display: "flex", gap: 1.5, overflowX: "auto", pb: 1.5, px: 2,
        scrollbarWidth: "none", "&::-webkit-scrollbar": { display: "none" } }}>
        {DAYS.map((label, d) => {
          const dayRoutine = routine.find((r) => r.dayOfWeek === d);
          const count = dayRoutine?.exercises?.length || 0;
          const isToday = d === dow;
          const categories = [...new Set((dayRoutine?.exercises || []).map((e) => e.machine.category))];
          return (
            <Box key={d} onClick={() => openEditDay(d)} sx={{
              minWidth: "58vw", maxWidth: "58vw", flexShrink: 0,
              p: 2.5, borderRadius: 3, cursor: "pointer",
              background: isToday
                ? "linear-gradient(145deg, rgba(34,197,94,0.18), rgba(34,197,94,0.04))"
                : "rgba(255,255,255,0.04)",
              border: isToday ? "1px solid rgba(34,197,94,0.28)" : "1px solid rgba(255,255,255,0.07)",
              "&:active": { opacity: 0.75 },
              display: "flex", flexDirection: "column",
            }}>
              {/* Dia */}
              <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
                <Typography fontSize="0.65rem" fontWeight={900} letterSpacing={1.5}
                  color={isToday ? "#22c55e" : "rgba(255,255,255,0.35)"}>
                  {label.toUpperCase()}
                </Typography>
                {isToday && (
                  <Box sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: "#22c55e",
                    boxShadow: "0 0 8px #22c55e" }} />
                )}
              </Stack>

              {count > 0 ? (
                <>
                  {/* Label ou número */}
                  {dayRoutine?.label ? (
                    <Typography fontWeight={900} fontSize="1.75rem" lineHeight={1.1} mb={0.3}
                      color={isToday ? "#22c55e" : "#EAF0FF"}>
                      {dayRoutine.label}
                    </Typography>
                  ) : (
                    <Typography fontWeight={900} lineHeight={1} mb={0.3}
                      sx={{ fontSize: "2.8rem", color: isToday ? "#22c55e" : "#EAF0FF" }}>
                      {count}
                    </Typography>
                  )}
                  <Typography variant="caption" color="text.secondary" mb={2.5}>
                    {count} exercício{count !== 1 ? "s" : ""}
                  </Typography>

                  {/* Grupos musculares */}
                  <Stack spacing={0.5} sx={{ mt: "auto" }}>
                    {categories.slice(0, 3).map((cat) => (
                      <Typography key={cat} fontSize="0.7rem" color={isToday ? "rgba(34,197,94,0.7)" : "rgba(255,255,255,0.4)"} noWrap>
                        · {cat}
                      </Typography>
                    ))}
                    {categories.length > 3 && (
                      <Typography fontSize="0.7rem" color="rgba(255,255,255,0.3)">
                        +{categories.length - 3} mais
                      </Typography>
                    )}
                  </Stack>
                </>
              ) : (
                <Box sx={{ mt: "auto" }}>
                  <Typography fontWeight={700} fontSize="0.9rem" color="rgba(255,255,255,0.2)">
                    Descanso
                  </Typography>
                </Box>
              )}
            </Box>
          );
        })}
      </Box>

      {/* Setup alerts */}
      {(!status?.hasMachines || !status?.hasRoutine) && (
        <Box sx={{ px: 2, mt: 2 }}>
          {!status?.hasMachines && (
            <Box sx={{ p: 1.5, borderRadius: 2.5, border: "1px solid rgba(250,204,21,0.2)", mb: 1 }}>
              <Typography variant="body2" fontWeight={700} sx={{ color: "#facc15" }}>Cadastre suas máquinas primeiro</Typography>
              <Button size="small" sx={{ mt: 0.5, color: "#facc15", fontWeight: 700, p: 0 }} onClick={() => navigate("/app/maquinas")}>Ir para Máquinas →</Button>
            </Box>
          )}
          {status?.hasMachines && !status?.hasRoutine && (
            <Box sx={{ p: 1.5, borderRadius: 2.5, border: "1px solid rgba(59,130,246,0.2)" }}>
              <Typography variant="body2" fontWeight={700} sx={{ color: "#3b82f6" }}>Monte sua rotina de treino</Typography>
              <Button size="small" sx={{ mt: 0.5, color: "#3b82f6", fontWeight: 700, p: 0 }} onClick={() => navigate("/app/rotina")}>Ir para Rotina →</Button>
            </Box>
          )}
        </Box>
      )}

      {/* Dialog editar dia da rotina */}
      <Dialog open={editDow !== null} onClose={() => setEditDow(null)} fullWidth maxWidth="sm"
        PaperProps={{ sx: { bgcolor: "#0a1628", backgroundImage: "none", borderRadius: 2 } }}>
        <DialogTitle sx={{ fontWeight: 900 }}>{editDow !== null ? DAYS[editDow] : ""}</DialogTitle>
        <DialogContent>
          {editExercises.length === 0 && (
            <Typography variant="body2" color="text.secondary" my={2} textAlign="center">Nenhum exercício. Adicione abaixo.</Typography>
          )}
          <List dense>
            {editExercises.map((ex, idx) => (
              <ListItem key={idx} sx={{ bgcolor: "rgba(255,255,255,0.04)", borderRadius: 2, mb: 0.5 }}>
                <ListItemText primary={ex.machineName} secondary={`${ex.sets}x${ex.reps}`} primaryTypographyProps={{ fontWeight: 600 }} />
                <ListItemSecondaryAction>
                  <IconButton size="small" onClick={() => setEditExercises((p) => p.filter((_, i) => i !== idx))} sx={{ color: "rgba(255,255,255,0.3)" }}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
          <Button startIcon={<AddIcon />} fullWidth variant="outlined" size="small" onClick={() => setAddOpen(true)} sx={{ mt: 1, borderColor: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.7)" }}>
            Adicionar exercício
          </Button>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setEditDow(null)} sx={{ color: "rgba(255,255,255,0.5)" }}>Cancelar</Button>
          <Button variant="contained" onClick={saveDay} disabled={saving}>
            {saving ? <CircularProgress size={18} /> : "Salvar"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog add exercício */}
      <Dialog open={addOpen} onClose={() => { setAddOpen(false); resetAddDialog(); }} fullWidth maxWidth="xs"
        PaperProps={{ sx: { bgcolor: "#0a1628", backgroundImage: "none", borderRadius: 2 } }}>
        <DialogTitle sx={{ fontWeight: 900, pb: 1 }}>Adicionar exercício</DialogTitle>
        <DialogContent sx={{ pt: 0.5, px: 2 }}>
          {/* Search */}
          <TextField
            fullWidth size="small" placeholder="Pesquisar exercício..."
            value={addSearch} onChange={(e) => setAddSearch(e.target.value)}
            InputProps={{ startAdornment: <SearchIcon sx={{ mr: 1, color: "rgba(255,255,255,0.3)", fontSize: 18 }} /> }}
            sx={{ mb: 1.5 }}
          />

          {/* Category chips */}
          <Box sx={{ display: "flex", gap: 0.75, overflowX: "auto", pb: 1, mb: 1,
            scrollbarWidth: "none", "&::-webkit-scrollbar": { display: "none" } }}>
            {["Todos", ...CATEGORIES].map((cat) => {
              const active = cat === "Todos" ? addCatFilter === null : addCatFilter === cat;
              return (
                <Chip key={cat} label={cat} size="small"
                  onClick={() => setAddCatFilter(cat === "Todos" ? null : cat)}
                  sx={{
                    flexShrink: 0, cursor: "pointer",
                    bgcolor: active ? "#22c55e" : "rgba(255,255,255,0.08)",
                    color: active ? "#050B1D" : "rgba(255,255,255,0.7)",
                    fontWeight: 700, fontSize: "0.68rem",
                    "&:hover": { bgcolor: active ? "#16a34a" : "rgba(255,255,255,0.14)" },
                  }}
                />
              );
            })}
          </Box>

          {/* Machine list */}
          <Box sx={{ maxHeight: 200, overflowY: "auto", mb: 1.5,
            scrollbarWidth: "thin", "&::-webkit-scrollbar": { width: 4 },
            "&::-webkit-scrollbar-thumb": { bgcolor: "rgba(255,255,255,0.1)", borderRadius: 4 } }}>
            {filteredAddMachines.length === 0 ? (
              <Typography variant="caption" color="text.secondary" textAlign="center" display="block" py={2}>
                Nenhum resultado.
              </Typography>
            ) : filteredAddMachines.map((m) => (
              <Box key={m.id} onClick={() => setAddMachineId(m.id)} sx={{
                p: 1.25, borderRadius: 2, mb: 0.5, cursor: "pointer",
                bgcolor: addMachineId === m.id ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${addMachineId === m.id ? "rgba(34,197,94,0.4)" : "rgba(255,255,255,0.06)"}`,
                display: "flex", alignItems: "center", justifyContent: "space-between",
                "&:active": { opacity: 0.7 },
              }}>
                <Typography fontSize="0.85rem" fontWeight={600}>{m.name}</Typography>
                <Typography variant="caption" color="text.secondary">{m.category}</Typography>
              </Box>
            ))}
          </Box>

          {/* Sets + Reps */}
          <Stack direction="row" spacing={1} mb={1.5}>
            <TextField label="Séries" type="number" value={addSets} onChange={(e) => setAddSets(e.target.value)} size="small" fullWidth />
            <TextField label="Reps" type="number" value={addReps} onChange={(e) => setAddReps(e.target.value)} size="small" fullWidth />
          </Stack>

          {/* Criar novo */}
          {!addCreateMode ? (
            <Button size="small" fullWidth onClick={() => setAddCreateMode(true)}
              sx={{ color: "rgba(255,255,255,0.4)", borderRadius: 2,
                border: "1px dashed rgba(255,255,255,0.12)", py: 0.8, fontSize: "0.78rem" }}>
              + Criar novo exercício
            </Button>
          ) : (
            <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <Typography variant="caption" color="text.secondary" fontWeight={700} mb={1} display="block" letterSpacing={0.5}>
                NOVO EXERCÍCIO
              </Typography>
              <Stack spacing={1}>
                <TextField value={addNewName} onChange={(e) => setAddNewName(e.target.value)}
                  label="Nome" size="small" fullWidth autoFocus />
                <TextField select value={addNewCat} onChange={(e) => setAddNewCat(e.target.value)}
                  label="Categoria" size="small" fullWidth>
                  {CATEGORIES.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                </TextField>
                <Stack direction="row" spacing={1}>
                  <Button size="small" onClick={() => { setAddCreateMode(false); setAddNewName(""); setAddNewCat(""); }}
                    sx={{ color: "rgba(255,255,255,0.4)", flex: 1 }}>Cancelar</Button>
                  <Button size="small" variant="contained" onClick={handleCreateAndAddMachine}
                    disabled={!addNewName || !addNewCat || creatingMachine} sx={{ flex: 1 }}>
                    {creatingMachine ? <CircularProgress size={16} /> : "Criar"}
                  </Button>
                </Stack>
              </Stack>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2.5 }}>
          <Button onClick={() => { setAddOpen(false); resetAddDialog(); }} sx={{ color: "rgba(255,255,255,0.5)" }}>Cancelar</Button>
          <Button variant="contained" onClick={addExercise} disabled={!addMachineId}>Adicionar</Button>
        </DialogActions>
      </Dialog>

      {/* Dialog Config */}
      <Dialog open={configOpen} onClose={() => setConfigOpen(false)} fullWidth maxWidth="xs"
        PaperProps={{ sx: { bgcolor: "#0a1628", backgroundImage: "none", borderRadius: 2 } }}>
        <DialogTitle sx={{ fontWeight: 900, pb: 1 }}>Configurações</DialogTitle>
        <DialogContent sx={{ px: 2.5 }}>

          {/* Perfil */}
          <Stack direction="row" alignItems="center" spacing={2} mb={2}>
            <Box sx={{ position: "relative" }}>
              <Avatar user={user} size={64} />
              <Box
                onClick={() => fileRef.current.click()}
                sx={{
                  position: "absolute", bottom: -2, right: -2,
                  width: 22, height: 22, borderRadius: "50%",
                  bgcolor: "#22c55e", display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", border: "2px solid #0c1530",
                }}
              >
                {savingPhoto ? <CircularProgress size={12} sx={{ color: "#fff" }} /> : <PhotoCameraIcon sx={{ fontSize: 11, color: "#111" }} />}
              </Box>
            </Box>
            <Box>
              <Typography fontWeight={700}>{user?.name || "—"}</Typography>
              <Typography variant="caption" color="text.secondary">{user?.email || user?.role}</Typography>
            </Box>
          </Stack>
          <input ref={fileRef} type="file" accept="image/*" capture="user" hidden onChange={handlePhotoChange} />

          <Divider sx={{ borderColor: "rgba(255,255,255,0.07)", mb: 2 }} />

          {/* Admin: gerenciar usuários */}
          {user?.role === "ADMIN" && (
            <>
              <Button
                fullWidth
                startIcon={<PeopleAltIcon />}
                onClick={() => { setConfigOpen(false); navigate("/app/usuarios"); }}
                sx={{
                  mb: 2, justifyContent: "flex-start", fontWeight: 700,
                  color: "#22c55e", borderRadius: 2,
                  border: "1px solid rgba(34,197,94,0.25)",
                  bgcolor: "rgba(34,197,94,0.07)",
                  "&:hover": { bgcolor: "rgba(34,197,94,0.15)" },
                }}
              >
                Gerenciar Usuários
              </Button>
            </>
          )}

          {/* Admin: simular dia — apenas para admins */}
          {user?.role === "ADMIN" && (
            <>
              <Typography variant="caption" color="text.secondary" fontWeight={700} letterSpacing={0.5}>
                ADMIN · SIMULAÇÃO DE DIA
              </Typography>
              <Box sx={{ mt: 1.5, p: 1.5, borderRadius: 2, bgcolor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography fontSize="0.82rem" color="text.secondary">Dia simulado</Typography>
                    <Typography fontWeight={800} color={simOffset > 0 ? "#facc15" : "text.primary"}>
                      {DAYS[getSimDay()]}
                      {simOffset > 0 && <Typography component="span" variant="caption" color="#facc15" ml={0.5}>(+{simOffset}d)</Typography>}
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={0.5}>
                    <IconButton
                      size="small"
                      onClick={handleResetDay}
                      sx={{ color: "#ef4444", border: "1px solid rgba(239,68,68,0.35)", borderRadius: 1.5,
                        "&:hover": { bgcolor: "rgba(239,68,68,0.1)" } }}
                    >
                      <RestartAltIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={handleAdvanceDay}
                      sx={{ color: "#22c55e", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 1.5 }}
                    >
                      <ArrowForwardIosIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Stack>
                </Stack>
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                Avança o dia simulado para testar rotinas. Não afeta o banco de dados.
              </Typography>
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button variant="contained" onClick={() => setConfigOpen(false)} fullWidth>Fechar</Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: sync success */}
      <Dialog open={syncDialogOpen} onClose={() => setSyncDialogOpen(false)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { bgcolor: "#0a1628", backgroundImage: "none", borderRadius: 2 } }}>
        <Box sx={{ p: 3.5, textAlign: "center" }}>
          <CheckCircleIcon sx={{ fontSize: 52, color: "#22c55e", mb: 1.5 }} />
          <Typography fontWeight={900} fontSize="1.15rem" mb={0.5}>
            App sincronizado!
          </Typography>
          <Typography variant="body2" color="text.secondary" lineHeight={1.6}>
            {syncCount === 1
              ? "1 treino registrado offline foi enviado ao servidor com sucesso."
              : `${syncCount} treinos registrados offline foram enviados ao servidor com sucesso.`}
          </Typography>
          <Button variant="contained" fullWidth sx={{ mt: 3 }} onClick={() => setSyncDialogOpen(false)}>
            Ok
          </Button>
        </Box>
      </Dialog>

      <BottomNav />
    </Box>
  );
}
