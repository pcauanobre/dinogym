import { useState } from "react";
import {
  Box, Typography, Button, Stack, CircularProgress,
  Dialog, DialogContent,
} from "@mui/material";

const NUTRITION_LABELS  = ["", "Ruim", "Ok", "Boa"];
const DAY_RATING_LABELS = ["", "Ruim", "Normal", "Top"];

export default function FinishDialog({ open, onClose, onFinish, saving }) {
  const [dayRating, setDayRating] = useState(0);
  const [nutrition, setNutrition] = useState(0);

  function handleClose() {
    onClose();
  }

  function handleFinish() {
    onFinish(dayRating, nutrition);
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
      <Box sx={{ px: 3, pt: 3, pb: 1 }}>
        <Typography fontWeight={900} fontSize="1.1rem">Finalizar treino</Typography>
      </Box>
      <DialogContent>
        <Stack spacing={2.5}>
          <Box>
            <Typography fontWeight={700} mb={1}>Como foi o dia?</Typography>
            <Stack direction="row" spacing={1}>
              {[1, 2, 3].map((v) => (
                <Button key={v} fullWidth size="small"
                  variant={dayRating === v ? "contained" : "outlined"}
                  onClick={() => setDayRating(v)}
                  sx={dayRating !== v ? { borderColor: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.6)" } : {}}>
                  {DAY_RATING_LABELS[v]}
                </Button>
              ))}
            </Stack>
          </Box>
          <Box>
            <Typography fontWeight={700} mb={1}>Alimentação?</Typography>
            <Stack direction="row" spacing={1}>
              {[1, 2, 3].map((v) => (
                <Button key={v} fullWidth size="small"
                  variant={nutrition === v ? "contained" : "outlined"}
                  onClick={() => setNutrition(v)}
                  sx={nutrition !== v ? { borderColor: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.6)" } : {}}>
                  {NUTRITION_LABELS[v]}
                </Button>
              ))}
            </Stack>
          </Box>
        </Stack>
      </DialogContent>
      <Box sx={{ px: 3, pb: 3, display: "flex", gap: 1.5 }}>
        <Button onClick={handleClose} sx={{ color: "rgba(255,255,255,0.5)" }}>Cancelar</Button>
        <Button variant="contained" fullWidth onClick={handleFinish}
          disabled={!dayRating || !nutrition || saving}>
          {saving ? <CircularProgress size={18} /> : "Finalizar"}
        </Button>
      </Box>
    </Dialog>
  );
}
