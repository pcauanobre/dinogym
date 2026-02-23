import { useState, useEffect } from "react";
import {
  Box, Typography, Button, Stack, CircularProgress,
  Dialog, IconButton, Chip, Popover, TextField,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

export default function EditEntryDialog({ open, exercise, onClose, onSave, onRedo, saving }) {
  const [editSets, setEditSets]                 = useState([]);
  const [editComment, setEditComment]           = useState("");
  const [editPopover, setEditPopover]           = useState(null); // { anchorEl, setIdx, field }
  const [editPopoverValue, setEditPopoverValue] = useState("");
  const [editRefazerConfirm, setEditRefazerConfirm] = useState(false);

  // Sync internal state when exercise changes (dialog opens with new data)
  useEffect(() => {
    if (exercise) {
      setEditSets(exercise._initialSets || []);
      setEditComment(exercise._initialComment || "");
      setEditPopover(null);
      setEditPopoverValue("");
      setEditRefazerConfirm(false);
    }
  }, [exercise]);

  function handleEditPopoverOpen(e, setIdx, field) {
    const val = field === "weight" ? editSets[setIdx].weight : editSets[setIdx].reps;
    setEditPopoverValue(String(val ?? ""));
    setEditPopover({ anchorEl: e.currentTarget, setIdx, field });
  }

  function handleEditPopoverSave() {
    const num = editPopover.field === "weight" ? parseFloat(editPopoverValue) : parseInt(editPopoverValue);
    if (!isNaN(num) && num > 0) {
      setEditSets((prev) => prev.map((s, i) => i === editPopover.setIdx ? { ...s, [editPopover.field]: num } : s));
    }
    setEditPopover(null);
  }

  function handleSave() {
    onSave(editSets, editComment);
  }

  function handleRedo() {
    setEditRefazerConfirm(false);
    onRedo(exercise);
  }

  if (!exercise) return null;

  return (
    <>
      {/* Dialog: editar entrada */}
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
        <Box sx={{ pb: 2 }}>
          <Box sx={{ px: 3, pt: 3, pb: 1.5, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Typography fontWeight={900} fontSize="1rem">{exercise.machine.name}</Typography>
            <IconButton size="small" onClick={onClose} sx={{ color: "rgba(255,255,255,0.4)" }}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>

          <Box sx={{ px: 2.5, display: "flex", flexDirection: "column", gap: 0.8 }}>
            {editSets.map((s, i) => (
              <Box key={i} sx={{
                display: "flex", alignItems: "center", gap: 1, px: 1.5, py: 1.1, borderRadius: 2,
                bgcolor: s.skipped ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.05)",
                border: `1px solid ${s.skipped ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.1)"}`,
              }}>
                <Typography fontSize="0.78rem" color="text.secondary" fontWeight={600} sx={{ minWidth: 48 }}>
                  Série {i + 1}
                </Typography>
                {s.skipped ? (
                  <Typography fontSize="0.82rem" color="rgba(255,255,255,0.3)" fontWeight={600}>não feita</Typography>
                ) : (
                  <>
                    <Chip
                      label={`${s.weight}kg`}
                      onClick={(e) => handleEditPopoverOpen(e, i, "weight")}
                      sx={{
                        bgcolor: "rgba(34,197,94,0.1)", color: "#22c55e",
                        border: "1px solid rgba(34,197,94,0.3)", fontWeight: 700,
                        cursor: "pointer", fontSize: "0.82rem", height: 28,
                        "&:hover": { bgcolor: "rgba(34,197,94,0.18)" },
                      }}
                    />
                    <Typography fontSize="0.75rem" color="text.secondary">×</Typography>
                    <Chip
                      label={`${s.reps} reps`}
                      onClick={(e) => handleEditPopoverOpen(e, i, "reps")}
                      sx={{
                        bgcolor: "rgba(34,197,94,0.1)", color: "#22c55e",
                        border: "1px solid rgba(34,197,94,0.3)", fontWeight: 700,
                        cursor: "pointer", fontSize: "0.82rem", height: 28,
                        "&:hover": { bgcolor: "rgba(34,197,94,0.18)" },
                      }}
                    />
                    {i > 0 && (
                      <Chip
                        label="Back-off"
                        onClick={() => setEditSets((prev) => prev.map((x, idx) => idx === i ? { ...x, isBackOff: !x.isBackOff } : x))}
                        sx={{
                          ml: "auto", height: 26, fontSize: "0.75rem", fontWeight: 700, cursor: "pointer",
                          bgcolor: s.isBackOff ? "rgba(250,204,21,0.15)" : "transparent",
                          color: s.isBackOff ? "#facc15" : "rgba(255,255,255,0.28)",
                          border: `1px solid ${s.isBackOff ? "rgba(250,204,21,0.4)" : "rgba(255,255,255,0.1)"}`,
                        }}
                      />
                    )}
                  </>
                )}
              </Box>
            ))}
          </Box>

          <Box sx={{ px: 2.5, mt: 2 }}>
            <TextField
              label="Comentários (opcional)" multiline rows={2}
              value={editComment} onChange={(e) => setEditComment(e.target.value)}
              fullWidth placeholder="Como foi o exercício?"
            />
          </Box>

          <Box sx={{ px: 2.5, mt: 2, display: "flex", flexDirection: "column", gap: 1 }}>
            <Button variant="contained" fullWidth onClick={handleSave} disabled={saving}
              sx={{ py: 1.4, fontWeight: 800, fontSize: "0.9rem", borderRadius: 2.5 }}>
              {saving ? <CircularProgress size={20} /> : "Salvar alterações"}
            </Button>
            <Button variant="outlined" fullWidth onClick={() => setEditRefazerConfirm(true)}
              sx={{ py: 1.2, fontWeight: 700, fontSize: "0.88rem", borderRadius: 2.5,
                borderColor: "rgba(239,68,68,0.3)", color: "rgba(239,68,68,0.7)",
                "&:hover": { borderColor: "rgba(239,68,68,0.6)", bgcolor: "rgba(239,68,68,0.05)" } }}>
              Refazer
            </Button>
            <Button variant="outlined" fullWidth onClick={onClose}
              sx={{ py: 1.2, fontWeight: 700, fontSize: "0.88rem", borderRadius: 2.5,
                borderColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.6)",
                "&:hover": { borderColor: "rgba(255,255,255,0.3)", bgcolor: "rgba(255,255,255,0.04)" } }}>
              Cancelar
            </Button>
          </Box>

        </Box>
      </Dialog>

      {/* Dialog: confirmar refazer */}
      <Dialog open={editRefazerConfirm} onClose={() => setEditRefazerConfirm(false)} maxWidth="xs" fullWidth>
        <Box sx={{ px: 3, pt: 3, pb: 3 }}>
          <Typography fontWeight={800} fontSize="1rem" mb={1}>Refazer exercício?</Typography>
          <Typography color="text.secondary" fontSize="0.88rem" mb={3}>
            Os dados registrados serão apagados e você vai preencher novamente do zero.
          </Typography>
          <Stack spacing={1}>
            <Button variant="contained" fullWidth onClick={handleRedo}
              sx={{ py: 1.3, fontWeight: 800, bgcolor: "#ef4444", "&:hover": { bgcolor: "#dc2626" } }}>
              Sim, refazer
            </Button>
            <Button variant="outlined" fullWidth onClick={() => setEditRefazerConfirm(false)}
              sx={{ py: 1.2, fontWeight: 700, borderColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.6)" }}>
              Cancelar
            </Button>
          </Stack>
        </Box>
      </Dialog>

      {/* Popover: editar valor */}
      <Popover
        open={!!editPopover}
        anchorEl={editPopover?.anchorEl}
        onClose={() => setEditPopover(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        transformOrigin={{ vertical: "top", horizontal: "center" }}
        slotProps={{ paper: { sx: { bgcolor: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 2, p: 2, minWidth: 160 } } }}
      >
        <TextField
          label={editPopover?.field === "weight" ? "Peso (kg)" : "Repetições"}
          type="number" size="small" fullWidth autoFocus
          value={editPopoverValue}
          onChange={(e) => setEditPopoverValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleEditPopoverSave(); }}
          inputProps={{ min: editPopover?.field === "weight" ? 0.5 : 1, step: editPopover?.field === "weight" ? 0.5 : 1 }}
        />
        <Button variant="contained" fullWidth size="small" onClick={handleEditPopoverSave}
          sx={{ mt: 1, fontWeight: 700, borderRadius: 1.5 }}>
          OK
        </Button>
      </Popover>
    </>
  );
}
