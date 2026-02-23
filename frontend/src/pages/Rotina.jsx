import { useState, useEffect } from "react";
import {
  Box, Typography, Button, Stack, CircularProgress, Container,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  IconButton, Collapse,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import api from "../utils/api.js";
import BottomNav from "../components/BottomNav.jsx";
import { getSimDay } from "../utils/simDay.js";
import { CATEGORY_GRADIENT, CATEGORY_COLOR } from "../constants/categories.js";
import { DAYS } from "../constants/dateLabels.js";
import { PAGE_BG } from "../constants/theme.js";
import ExerciseThumbnail from "../components/ExerciseThumbnail.jsx";

// "6-9" → { reps: 6, repsMax: 9 }, "12" → { reps: 12, repsMax: null }
function parseReps(str) {
  const s = String(str ?? "").trim();
  const match = s.match(/^(\d+)\s*[-–]\s*(\d+)$/);
  if (match) {
    const lo = parseInt(match[1]);
    const hi = parseInt(match[2]);
    return { reps: Math.min(lo, hi), repsMax: Math.max(lo, hi) };
  }
  const n = parseInt(s);
  return { reps: isNaN(n) ? 12 : n, repsMax: null };
}

function formatReps(reps, repsMax) {
  return repsMax ? `${reps}-${repsMax}` : String(reps ?? "");
}

export default function Rotina() {
  const [routine, setRoutine] = useState([]);
  const [machines, setMachines] = useState([]);
  const [loading, setLoading] = useState(true);

  // Edit day
  const [editDow, setEditDow] = useState(null);
  const [editLabel, setEditLabel] = useState("");
  const [editExercises, setEditExercises] = useState([]);
  const [saving, setSaving] = useState(false);

  // Bulk edit reps dentro do dia (inline)
  const [bulkRepsOpen, setBulkRepsOpen] = useState(false);
  const [bulkRepsValue, setBulkRepsValue] = useState("");

  // Bulk edit global (todas as reps da rotina inteira)
  const [globalBulkOpen, setGlobalBulkOpen] = useState(false);
  const [globalBulkValue, setGlobalBulkValue] = useState("");
  const [globalBulkSaving, setGlobalBulkSaving] = useState(false);

  // Edit individual exercise
  const [editExIdx, setEditExIdx] = useState(null);
  const [editExSets, setEditExSets] = useState("3");
  const [editExReps, setEditExReps] = useState("12");

  // Add exercise: step 1 = pick machine, step 2 = sets/reps
  const [pickOpen, setPickOpen] = useState(false);
  const [pickedMachine, setPickedMachine] = useState(null);
  const [addSets, setAddSets] = useState("2");
  const [addReps, setAddReps] = useState("12");
  const [setsOpen, setSetsOpen] = useState(false);

  const todayDow = getSimDay();

  useEffect(() => {
    Promise.all([api.get("/routine"), api.get("/machines")]).then(([rRes, mRes]) => {
      setRoutine(rRes.data);
      setMachines(mRes.data);
      setLoading(false);
    });
  }, []);

  function openEdit(dow) {
    const existing = routine.find((d) => d.dayOfWeek === dow);
    setEditDow(dow);
    setEditLabel(existing?.label || "");
    setBulkRepsOpen(false);
    setBulkRepsValue("");
    setEditExercises(
      existing?.exercises?.map((e) => ({
        machineId: e.machine.id,
        machine: machines.find((m) => m.id === e.machine.id) || e.machine,
        sets: e.sets,
        reps: e.reps,
        repsMax: e.repsMax ?? null,
      })) || []
    );
  }

  function applyBulkReps() {
    const parsed = parseReps(bulkRepsValue);
    setEditExercises((prev) => prev.map((e) => ({ ...e, reps: parsed.reps, repsMax: parsed.repsMax })));
    setBulkRepsOpen(false);
    setBulkRepsValue("");
  }

  async function applyGlobalBulkReps() {
    const parsed = parseReps(globalBulkValue);
    setGlobalBulkSaving(true);
    try {
      const daysWithEx = routine.filter((d) => d.exercises?.length > 0);
      const updated = [];
      for (const day of daysWithEx) {
        const exercises = day.exercises.map((e) => ({
          machineId: e.machine.id,
          sets: e.sets,
          reps: parsed.reps,
          repsMax: parsed.repsMax,
        }));
        const r = await api.put(`/routine/day/${day.dayOfWeek}`, {
          label: day.label ?? null,
          exercises,
        });
        if (r.data?.id) updated.push(r.data);
      }
      setRoutine((prev) => {
        const dows = updated.map((d) => d.dayOfWeek);
        return [...prev.filter((d) => !dows.includes(d.dayOfWeek)), ...updated].sort(
          (a, b) => a.dayOfWeek - b.dayOfWeek
        );
      });
      setGlobalBulkOpen(false);
      setGlobalBulkValue("");
    } catch {
      // silently fail — server may be down
    } finally {
      setGlobalBulkSaving(false);
    }
  }

  function selectMachine(m) {
    setPickedMachine(m);
    setPickOpen(false);
    setSetsOpen(true);
  }

  function confirmAdd() {
    const parsed = parseReps(addReps);
    setEditExercises((prev) => [
      ...prev,
      {
        machineId: pickedMachine.id,
        machine: pickedMachine,
        sets: parseInt(addSets) || 2,
        reps: parsed.reps,
        repsMax: parsed.repsMax,
      },
    ]);
    setSetsOpen(false);
    setPickedMachine(null);
    setAddSets("2");
    setAddReps("12");
  }

  function openEditEx(idx) {
    const ex = editExercises[idx];
    setEditExSets(String(ex.sets));
    setEditExReps(formatReps(ex.reps, ex.repsMax));
    setEditExIdx(idx);
  }

  async function confirmEditEx() {
    const parsed = parseReps(editExReps);
    const newExercises = editExercises.map((ex, i) =>
      i === editExIdx
        ? { ...ex, sets: parseInt(editExSets) || ex.sets, reps: parsed.reps, repsMax: parsed.repsMax }
        : ex
    );
    setEditExercises(newExercises);
    setEditExIdx(null);
    setSaving(true);
    try {
      const r = await api.put(`/routine/day/${editDow}`, {
        label: editLabel.trim() || null,
        exercises: newExercises.map((e) => ({ machineId: e.machineId, sets: e.sets, reps: e.reps, repsMax: e.repsMax ?? null })),
      });
      setRoutine((prev) => {
        const without = prev.filter((d) => d.dayOfWeek !== editDow);
        if (r.data?.id) return [...without, r.data].sort((a, b) => a.dayOfWeek - b.dayOfWeek);
        return without;
      });
    } finally {
      setSaving(false);
    }
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
    setSaving(false);
    setEditDow(null);
  }

  const bg = PAGE_BG;

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
        <Box sx={{ pt: 5, pb: 2 }}>
          <Stack direction="row" alignItems="flex-end" justifyContent="space-between">
            <Box>
              <Typography variant="h6" fontWeight={900}>Rotina semanal</Typography>
              <Typography variant="body2" color="text.secondary">Toque no dia para editar</Typography>
            </Box>
            <Button
              size="small"
              variant="outlined"
              onClick={(e) => { e.currentTarget.blur(); setGlobalBulkValue(""); setGlobalBulkOpen(true); }}
              sx={{
                mb: 0.3, fontSize: "0.72rem", fontWeight: 700, borderRadius: 2,
                borderColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.5)",
                textTransform: "none", whiteSpace: "nowrap",
                "&:hover": { borderColor: "rgba(255,255,255,0.3)", color: "rgba(255,255,255,0.8)" },
              }}
            >
              Editar todas as reps
            </Button>
          </Stack>
        </Box>

        <Stack spacing={1.5}>
          {DAYS.map((label, dow) => {
            const day = routine.find((d) => d.dayOfWeek === dow);
            const exercises = day?.exercises || [];
            const isToday = dow === todayDow;

            return (
              <Box
                key={dow}
                sx={{
                  borderRadius: 1.5,
                  overflow: "hidden",
                  border: isToday
                    ? "1px solid rgba(34,197,94,0.3)"
                    : "1px solid rgba(255,255,255,0.07)",
                  background: isToday
                    ? "linear-gradient(135deg, rgba(34,197,94,0.08), rgba(34,197,94,0.02))"
                    : "rgba(255,255,255,0.04)",
                }}
              >
                {/* Day header */}
                <Box
                  onClick={() => openEdit(dow)}
                  sx={{
                    px: 2, pt: 1.5, pb: exercises.length > 0 ? 1 : 1.5,
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    cursor: "pointer",
                  }}
                >
                  <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
                    <Typography
                      fontWeight={800}
                      fontSize="0.97rem"
                      color={exercises.length > 0 ? (isToday ? "#22c55e" : "text.primary") : "text.secondary"}
                    >
                      {label}
                    </Typography>
                    {isToday && (
                      <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: "#22c55e", flexShrink: 0 }} />
                    )}
                    {day?.label && (
                      <Box sx={{
                        px: 0.9, py: 0.15, borderRadius: 1,
                        bgcolor: isToday ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.07)",
                        border: isToday ? "1px solid rgba(34,197,94,0.25)" : "1px solid rgba(255,255,255,0.1)",
                      }}>
                        <Typography fontSize="0.68rem" fontWeight={800}
                          color={isToday ? "#22c55e" : "rgba(255,255,255,0.5)"}>
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

                {/* Exercise rows */}
                {exercises.length > 0 ? (
                  <Stack>
                    {exercises.map((ex, i) => {
                      const machine = machines.find((m) => m.id === ex.machine.id) || ex.machine;
                      return (
                        <Box key={ex.id}>
                          {i > 0 && (
                            <Box sx={{ height: "1px", bgcolor: "rgba(255,255,255,0.05)", mx: 2 }} />
                          )}
                          <Box
                            onClick={() => openEdit(dow)}
                            sx={{
                              px: 2, py: 1.2,
                              display: "flex", alignItems: "center", gap: 1.5,
                              cursor: "pointer",
                              "&:active": { opacity: 0.7 },
                            }}
                          >
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
      </Container>

      {/* Dialog: editar reps de toda a rotina */}
      <Dialog open={globalBulkOpen} onClose={() => setGlobalBulkOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 900, pb: 0.5 }}>Editar todas as reps</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Aplica o mesmo valor de reps para todos os exercícios de todos os dias.
          </Typography>
          <TextField
            label="Reps (ex: 12 ou 6-9)"
            type="text"
            value={globalBulkValue}
            onChange={(e) => setGlobalBulkValue(e.target.value)}
            size="small"
            fullWidth
            autoFocus
            placeholder="12 ou 6-9"
            onKeyDown={(e) => { if (e.key === "Enter" && globalBulkValue.trim()) applyGlobalBulkReps(); }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setGlobalBulkOpen(false)} sx={{ color: "rgba(255,255,255,0.5)" }}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={applyGlobalBulkReps}
            disabled={!globalBulkValue.trim() || globalBulkSaving}
          >
            {globalBulkSaving ? <CircularProgress size={18} /> : "Aplicar"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: editar dia */}
      <Dialog
        open={editDow !== null}
        onClose={() => setEditDow(null)}
        fullWidth maxWidth="sm"
        disableRestoreFocus
      >
        <DialogTitle sx={{ fontWeight: 900 }}>
          {editDow !== null ? DAYS[editDow] : ""}
        </DialogTitle>
        <DialogContent sx={{ px: 2, pt: 2.5, pb: 1, overflow: "visible" }}>
          <TextField
            label="Título do treino (ex: Pull, Push, Leg...)"
            value={editLabel}
            onChange={(e) => setEditLabel(e.target.value)}
            size="small"
            fullWidth
            sx={{ mb: 2 }}
            inputProps={{ maxLength: 30 }}
          />
          <Box sx={{ overflowY: "auto", maxHeight: "52vh" }}>
            {editExercises.length === 0 && (
              <Typography variant="body2" color="text.secondary" my={2} textAlign="center">
                Nenhum exercício ainda.
              </Typography>
            )}

            {/* Bulk edit reps inline dentro do dia */}
            {editExercises.length > 1 && (
              <Box sx={{ mb: 1.5 }}>
                {!bulkRepsOpen ? (
                  <Button
                    size="small"
                    variant="text"
                    onClick={() => { setBulkRepsOpen(true); setBulkRepsValue(""); }}
                    sx={{ color: "rgba(255,255,255,0.35)", fontSize: "0.75rem", textTransform: "none", p: 0, minWidth: 0 }}
                  >
                    Editar todas as reps deste dia
                  </Button>
                ) : (
                  <Collapse in={bulkRepsOpen}>
                    <Stack direction="row" spacing={1} alignItems="center"
                      sx={{ p: 1.2, borderRadius: 2, bgcolor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                      <TextField
                        size="small"
                        label="Reps (ex: 12 ou 6-9)"
                        value={bulkRepsValue}
                        onChange={(e) => setBulkRepsValue(e.target.value)}
                        autoFocus
                        sx={{ flex: 1 }}
                        onKeyDown={(e) => { if (e.key === "Enter" && bulkRepsValue) applyBulkReps(); if (e.key === "Escape") setBulkRepsOpen(false); }}
                      />
                      <Button
                        size="small" variant="contained"
                        onClick={applyBulkReps}
                        disabled={!bulkRepsValue.trim()}
                        sx={{ fontWeight: 700, whiteSpace: "nowrap" }}
                      >
                        Aplicar
                      </Button>
                      <Button
                        size="small"
                        onClick={() => setBulkRepsOpen(false)}
                        sx={{ color: "rgba(255,255,255,0.4)", minWidth: 0, px: 0.5 }}
                      >
                        ✕
                      </Button>
                    </Stack>
                  </Collapse>
                )}
              </Box>
            )}

            <Stack spacing={0.8} mb={1.5}>
              {editExercises.map((ex, idx) => (
                <Box
                  key={idx}
                  sx={{
                    display: "flex", alignItems: "center", gap: 1,
                    p: 1.2, borderRadius: 2.5,
                    bgcolor: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <ExerciseThumbnail machine={ex.machine} size={48} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography fontWeight={600} fontSize="0.87rem" noWrap>{ex.machine.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {ex.sets} séries × {formatReps(ex.reps, ex.repsMax)} reps
                    </Typography>
                  </Box>
                  <IconButton
                    onClick={(e) => { e.currentTarget.blur(); openEditEx(idx); }}
                    sx={{ color: "rgba(255,255,255,0.55)", p: 1 }}
                  >
                    <EditIcon sx={{ fontSize: 22 }} />
                  </IconButton>
                  <IconButton
                    onClick={() => setEditExercises((p) => p.filter((_, i) => i !== idx))}
                    sx={{ color: "#ef4444", p: 1 }}
                  >
                    <DeleteIcon sx={{ fontSize: 22 }} />
                  </IconButton>
                </Box>
              ))}
            </Stack>
            <Button
              startIcon={<AddIcon />}
              fullWidth
              variant="outlined"
              size="small"
              onClick={(e) => { e.currentTarget.blur(); setPickOpen(true); }}
              sx={{ borderColor: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.6)", borderRadius: 2 }}
            >
              Adicionar exercício
            </Button>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setEditDow(null)} sx={{ color: "rgba(255,255,255,0.5)" }}>
            Cancelar
          </Button>
          <Button variant="contained" onClick={saveDay} disabled={saving}>
            {saving ? <CircularProgress size={18} /> : "Salvar"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: escolher máquina */}
      <Dialog
        open={pickOpen}
        onClose={() => setPickOpen(false)}
        fullWidth maxWidth="sm"
        disableRestoreFocus
      >
        <DialogTitle sx={{ fontWeight: 900, pb: 1 }}>Escolher máquina</DialogTitle>
        <DialogContent sx={{ px: 2, pt: 0, pb: 2 }}>
          <Stack spacing={0.7}>
            {machines.map((m) => (
              <Box
                key={m.id}
                onClick={() => selectMachine(m)}
                sx={{
                  display: "flex", alignItems: "center", gap: 1.5,
                  p: 1.1, borderRadius: 2.5, cursor: "pointer",
                  bgcolor: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  "&:active": { opacity: 0.7 },
                  "&:hover": { bgcolor: "rgba(255,255,255,0.07)" },
                }}
              >
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

      {/* Dialog: editar exercício existente */}
      <Dialog
        open={editExIdx !== null}
        onClose={() => setEditExIdx(null)}
        fullWidth maxWidth="xs"
        disableRestoreFocus
      >
        <DialogTitle sx={{ fontWeight: 900, pb: 1 }}>
          {editExIdx !== null && editExercises[editExIdx] ? (
            <Stack direction="row" alignItems="center" gap={1.5}>
              <ExerciseThumbnail machine={editExercises[editExIdx].machine} size={42} />
              <Box>
                <Typography fontWeight={800} fontSize="0.95rem" lineHeight={1.2}>
                  {editExercises[editExIdx].machine.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {editExercises[editExIdx].machine.category}
                </Typography>
              </Box>
            </Stack>
          ) : "Editar exercício"}
        </DialogTitle>
        <DialogContent>
          <Stack direction="row" spacing={2} mt={0.5}>
            <TextField
              label="Séries" type="number" value={editExSets}
              onChange={(e) => setEditExSets(e.target.value)}
              size="small" fullWidth inputProps={{ min: 1 }}
            />
            <TextField
              label="Reps" type="text" value={editExReps}
              onChange={(e) => setEditExReps(e.target.value)}
              size="small" fullWidth
              placeholder="12 ou 6-9"
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setEditExIdx(null)} sx={{ color: "rgba(255,255,255,0.5)" }}>
            Cancelar
          </Button>
          <Button variant="contained" onClick={confirmEditEx} disabled={saving}>
            {saving ? <CircularProgress size={18} /> : "Salvar"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: séries e reps */}
      <Dialog
        open={setsOpen}
        onClose={() => setSetsOpen(false)}
        fullWidth maxWidth="xs"
        disableRestoreFocus
      >
        <DialogTitle sx={{ fontWeight: 900, pb: 1 }}>
          {pickedMachine && (
            <Stack direction="row" alignItems="center" gap={1.5}>
              <ExerciseThumbnail machine={pickedMachine} size={42} />
              <Box>
                <Typography fontWeight={800} fontSize="0.95rem" lineHeight={1.2}>
                  {pickedMachine.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {pickedMachine.category}
                </Typography>
              </Box>
            </Stack>
          )}
        </DialogTitle>
        <DialogContent>
          <Stack direction="row" spacing={2} mt={0.5}>
            <TextField
              label="Séries" type="number" value={addSets}
              onChange={(e) => setAddSets(e.target.value)}
              size="small" fullWidth
              inputProps={{ min: 1 }}
            />
            <TextField
              label="Reps" type="text" value={addReps}
              onChange={(e) => setAddReps(e.target.value)}
              size="small" fullWidth
              placeholder="12 ou 6-9"
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setSetsOpen(false)} sx={{ color: "rgba(255,255,255,0.5)" }}>
            Cancelar
          </Button>
          <Button variant="contained" onClick={confirmAdd}>
            Adicionar
          </Button>
        </DialogActions>
      </Dialog>

      <BottomNav />
    </Box>
  );
}
