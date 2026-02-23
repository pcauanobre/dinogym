import { memo } from "react";
import { Box } from "@mui/material";
import FitnessCenterIcon from "@mui/icons-material/FitnessCenter";
import { CATEGORY_GRADIENT, CATEGORY_COLOR } from "../constants/categories.js";

const ExerciseThumbnail = memo(function ExerciseThumbnail({ machine, size = 58 }) {
  const grad = CATEGORY_GRADIENT[machine?.category] || CATEGORY_GRADIENT.Outro;
  const color = CATEGORY_COLOR[machine?.category] || "#aaa";

  if (machine?.photoBase64) {
    return (
      <Box
        component="img"
        src={machine.photoBase64}
        sx={{ width: size, height: size, objectFit: "cover", borderRadius: 2, flexShrink: 0 }}
      />
    );
  }
  return (
    <Box sx={{
      width: size, height: size, borderRadius: 2, flexShrink: 0,
      background: grad,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <FitnessCenterIcon sx={{ fontSize: size * 0.42, color, opacity: 0.9 }} />
    </Box>
  );
});

export default ExerciseThumbnail;
