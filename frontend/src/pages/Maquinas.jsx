import { useState, useEffect, useRef, useDeferredValue, useCallback, useMemo, memo } from "react";
import {
  Box, Typography, Button, Stack, Chip, Container, InputBase,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
  IconButton, CircularProgress, Fab,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import SearchIcon from "@mui/icons-material/Search";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";
import FitnessCenterIcon from "@mui/icons-material/FitnessCenter";
import api from "../utils/api.js";
import { CATEGORIES, CATEGORY_GRADIENT, CATEGORY_COLOR } from "../constants/categories.js";
import { PAGE_BG } from "../constants/theme.js";
import ExerciseThumbnail from "../components/ExerciseThumbnail.jsx";
import Glass from "../components/Glass.jsx";
import BottomNav from "../components/BottomNav.jsx";

// Memoized card — only re-renders when this specific machine changes
const ExerciseCard = memo(function ExerciseCard({ m, onToggleFavorite, onEdit }) {
  const color = CATEGORY_COLOR[m.category] || "#aaa";
  return (
    <Glass sx={{ display: "flex", alignItems: "stretch", overflow: "hidden", minHeight: 76 }}>
      <ExerciseThumbnail machine={m} size={90} />
      <Box sx={{ flex: 1, px: 1.5, py: 1.2, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between">
          <Box sx={{ flex: 1, pr: 0.5 }}>
            <Typography fontWeight={700} fontSize="0.9rem" lineHeight={1.3}>{m.name}</Typography>
            <Chip label={m.category} size="small" sx={{
              mt: 0.4, height: 18, fontSize: "0.6rem",
              bgcolor: `${color}18`, color, border: `1px solid ${color}33`,
            }} />
          </Box>
          <Stack direction="row" alignItems="center" spacing={0} sx={{ mt: -0.5, mr: -0.5 }}>
            <IconButton size="small" onClick={() => onToggleFavorite(m.id)}
              sx={{ color: m.isFavorite ? "#facc15" : "rgba(255,255,255,0.25)", p: 0.7 }}>
              {m.isFavorite ? <StarIcon sx={{ fontSize: 18 }} /> : <StarBorderIcon sx={{ fontSize: 18 }} />}
            </IconButton>
            <IconButton size="small" onClick={(e) => { e.currentTarget.blur(); onEdit(m); }}
              sx={{ color: "rgba(255,255,255,0.25)", p: 0.7 }}>
              <EditIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Stack>
        </Stack>
        {m.currentPR != null && (
          <Stack direction="row" alignItems="center" spacing={0.4}>
            <EmojiEventsIcon sx={{ fontSize: 13, color: "#facc15" }} />
            <Typography variant="caption" sx={{ color: "#facc15", fontWeight: 700 }}>
              PR: {m.currentPR}kg
            </Typography>
          </Stack>
        )}
      </Box>
    </Glass>
  );
});

function MachineForm({ initial, onSave, onDelete, onClose }) {
  const [name, setName] = useState(initial?.name || "");
  const [category, setCategory] = useState(initial?.category || "");
  const [photo, setPhoto] = useState(initial?.photoBase64 || null);
  const [pr, setPr] = useState(initial?.currentPR ?? "");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fileRef = useRef();

  function handlePhoto(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setPhoto(ev.target.result);
    reader.readAsDataURL(file);
  }

  async function handleSave() {
    if (!name.trim() || !category) return;
    setSaving(true);
    await onSave({ name: name.trim(), category, photoBase64: photo, currentPR: pr !== "" ? parseFloat(pr) : null });
    setSaving(false);
  }

  const grad = category ? (CATEGORY_GRADIENT[category] || CATEGORY_GRADIENT.Outro) : "linear-gradient(160deg, #1a1a2e, #16213e)";
  const color = category ? (CATEGORY_COLOR[category] || "#aaa") : "rgba(255,255,255,0.3)";

  return (
    <>
      <DialogContent>
        <Stack spacing={2} mt={0.5}>
          <Box onClick={() => fileRef.current.click()}
            sx={{
              height: 130, background: photo ? "none" : grad, borderRadius: 2,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", overflow: "hidden",
              border: "1px solid rgba(255,255,255,0.08)", transition: "background 0.3s",
              "&:active": { opacity: 0.8 },
            }}>
            {photo ? (
              <img src={photo} alt="exercício" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <Stack alignItems="center" spacing={0.8}>
                <FitnessCenterIcon sx={{ color, fontSize: 34, opacity: 0.8 }} />
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <PhotoCameraIcon sx={{ color: "rgba(255,255,255,0.35)", fontSize: 13 }} />
                  <Typography variant="caption" color="text.secondary">Toque para foto</Typography>
                </Stack>
              </Stack>
            )}
          </Box>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={handlePhoto} />
          <TextField label="Nome do exercício" value={name} onChange={(e) => setName(e.target.value)} fullWidth size="small" />
          <TextField select label="Categoria" value={category} onChange={(e) => setCategory(e.target.value)} fullWidth size="small"
            SelectProps={{ MenuProps: { PaperProps: { sx: { maxHeight: 240 } } } }}>
            {CATEGORIES.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
          </TextField>
          <TextField label="PR atual (kg)" type="number" value={pr} onChange={(e) => setPr(e.target.value)} fullWidth size="small" />
        </Stack>
      </DialogContent>

      {confirmDelete ? (
        <Box sx={{ px: 3, pb: 3 }}>
          <Typography fontSize="0.85rem" color="text.secondary" mb={1.5}>
            Excluir este exercício permanentemente?
          </Typography>
          <Stack direction="row" spacing={1}>
            <Button fullWidth onClick={() => setConfirmDelete(false)} variant="outlined"
              sx={{ borderColor: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.5)" }}>
              Cancelar
            </Button>
            <Button fullWidth variant="contained" onClick={onDelete}
              sx={{ bgcolor: "#ef4444", "&:hover": { bgcolor: "#dc2626" } }}>
              Excluir
            </Button>
          </Stack>
        </Box>
      ) : (
        <DialogActions sx={{ px: 3, pb: 2.5, justifyContent: "space-between" }}>
          {onDelete ? (
            <IconButton onClick={() => setConfirmDelete(true)} sx={{ color: "#ef4444" }}>
              <DeleteIcon />
            </IconButton>
          ) : <Box />}
          <Stack direction="row" spacing={1}>
            <Button onClick={onClose} sx={{ color: "rgba(255,255,255,0.5)" }}>Cancelar</Button>
            <Button variant="contained" onClick={handleSave} disabled={saving || !name.trim() || !category}>
              {saving ? <CircularProgress size={18} /> : "Salvar"}
            </Button>
          </Stack>
        </DialogActions>
      )}
    </>
  );
}

export default function Maquinas() {
  const [machines, setMachines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openAdd, setOpenAdd] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filter, setFilter] = useState("Todos");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    api.get("/machines").then((r) => { setMachines(r.data); setLoading(false); });
  }, []);

  async function handleAdd(data) {
    const r = await api.post("/machines", data);
    setMachines((prev) => [r.data, ...prev]);
    setOpenAdd(false);
  }

  async function handleEdit(data) {
    const r = await api.patch(`/machines/${editing.id}`, data);
    setMachines((prev) => prev.map((m) => (m.id === editing.id ? r.data : m)));
    setEditing(null);
  }

  async function handleDelete() {
    await api.delete(`/machines/${editing.id}`);
    setMachines((prev) => prev.filter((m) => m.id !== editing.id));
    setEditing(null);
  }

  // Stable callbacks so ExerciseCard doesn't re-render when parent re-renders
  const handleToggleFavorite = useCallback(async (id) => {
    const r = await api.patch(`/machines/${id}/favorite`);
    setMachines((prev) => prev.map((m) => (m.id === id ? r.data : m)));
  }, []);

  const handleEdit_card = useCallback((m) => setEditing(m), []);

  const categories = useMemo(
    () => ["Todos", "Favoritos", ...Array.from(new Set(machines.map((m) => m.category))).sort()],
    [machines]
  );

  const filtered = useMemo(() => machines
    .filter((m) => {
      if (filter === "Favoritos") return m.isFavorite;
      if (filter !== "Todos") return m.category === filter;
      return true;
    })
    .filter((m) => deferredSearch === "" || m.name.toLowerCase().includes(deferredSearch.toLowerCase())),
    [machines, filter, deferredSearch]
  );

  const bg = PAGE_BG;

  return (
    <Box sx={{ minHeight: "100vh", pb: 10, background: bg }}>
      <Container maxWidth="sm" sx={{ px: 2 }}>
        <Box sx={{ pt: 5, pb: 1.5 }}>
          <Typography variant="h6" fontWeight={900} mb={1.5}>Exercícios</Typography>

          {/* Search bar */}
          <Box sx={{
            display: "flex", alignItems: "center", gap: 1,
            px: 1.5, py: 1, borderRadius: 3,
            bgcolor: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.09)",
            mb: 1.5,
            "&:focus-within": {
              border: "1px solid rgba(34,197,94,0.35)",
              bgcolor: "rgba(34,197,94,0.04)",
            },
          }}>
            <SearchIcon sx={{ fontSize: 18, color: "rgba(255,255,255,0.3)", flexShrink: 0 }} />
            <InputBase
              placeholder="Pesquisar exercício..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              fullWidth
              sx={{ fontSize: "0.88rem", color: "rgba(255,255,255,0.85)",
                "& input::placeholder": { color: "rgba(255,255,255,0.3)", opacity: 1 } }}
            />
            {search && (
              <IconButton size="small" onClick={() => setSearch("")}
                sx={{ p: 0.2, color: "rgba(255,255,255,0.3)" }}>
                <Box sx={{ fontSize: 14, lineHeight: 1 }}>✕</Box>
              </IconButton>
            )}
          </Box>
        </Box>

        {/* Category chips */}
        <Box sx={{ pb: 1.5, display: "flex", gap: 0.8, overflowX: "auto", scrollbarWidth: "none" }}>
          {categories.map((c) => (
            <Chip key={c} label={c} size="small" clickable onClick={() => setFilter(c)}
              sx={{
                flexShrink: 0,
                bgcolor: filter === c
                  ? (c === "Favoritos" ? "rgba(250,204,21,0.2)" : "rgba(34,197,94,0.2)")
                  : "rgba(255,255,255,0.06)",
                color: filter === c
                  ? (c === "Favoritos" ? "#facc15" : "#22c55e")
                  : "rgba(255,255,255,0.6)",
                border: filter === c
                  ? (c === "Favoritos" ? "1px solid rgba(250,204,21,0.3)" : "1px solid rgba(34,197,94,0.3)")
                  : "1px solid transparent",
                "&:hover": { bgcolor: "rgba(255,255,255,0.1)" },
              }} />
          ))}
        </Box>

        {loading && <CircularProgress sx={{ mt: 4, display: "block", mx: "auto" }} />}

        {!loading && filtered.length === 0 && (
          <Box textAlign="center" mt={6}>
            <Typography color="text.secondary">
              {deferredSearch
                ? `Nenhum resultado para "${deferredSearch}".`
                : filter === "Favoritos"
                  ? "Nenhum exercício favorito ainda."
                  : "Nenhum exercício encontrado."}
            </Typography>
          </Box>
        )}

        <Stack spacing={1}>
          {filtered.map((m) => (
            <ExerciseCard
              key={m.id}
              m={m}
              onToggleFavorite={handleToggleFavorite}
              onEdit={handleEdit_card}
            />
          ))}
        </Stack>
      </Container>

      <Fab color="primary" sx={{ position: "fixed", bottom: 80, right: 20, color: "#050B1D" }}
        onClick={(e) => { e.currentTarget.blur(); setOpenAdd(true); }}>
        <AddIcon />
      </Fab>

      <Dialog open={openAdd} onClose={() => setOpenAdd(false)} fullWidth maxWidth="sm" disableRestoreFocus>
        <DialogTitle sx={{ fontWeight: 900 }}>Novo exercício</DialogTitle>
        <MachineForm onSave={handleAdd} onClose={() => setOpenAdd(false)} />
      </Dialog>

      <Dialog open={!!editing} onClose={() => setEditing(null)} fullWidth maxWidth="sm" disableRestoreFocus>
        <DialogTitle sx={{ fontWeight: 900 }}>Editar exercício</DialogTitle>
        {editing && (
          <MachineForm
            initial={editing}
            onSave={handleEdit}
            onDelete={handleDelete}
            onClose={() => setEditing(null)}
          />
        )}
      </Dialog>

      <BottomNav />
    </Box>
  );
}
