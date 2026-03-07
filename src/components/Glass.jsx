import { Box } from "@mui/material";

export default function Glass({ children, sx, ...props }) {
  return (
    <Box
      sx={{
        bgcolor: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
        backdropFilter: "blur(14px)",
        borderRadius: 3,
        ...sx,
      }}
      {...props}
    >
      {children}
    </Box>
  );
}
