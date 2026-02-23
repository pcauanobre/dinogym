import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  palette: {
    mode: "dark",
    background: {
      default: "#050B1D",
      paper: "rgba(255,255,255,0.06)",
    },
    primary: { main: "#22c55e" },
    text: {
      primary: "#EAF0FF",
      secondary: "rgba(234,240,255,0.55)",
    },
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: ["Inter", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Arial", "sans-serif"].join(","),
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { textTransform: "none", fontWeight: 700, borderRadius: 10 },
        containedPrimary: {
          color: "#050B1D",
          "&:hover": { backgroundColor: "#16a34a" },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          background: "#0c1530",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 16,
        },
        root: {
          "& .MuiBackdrop-root": {
            backgroundColor: "rgba(0,0,0,0.75)",
          },
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          background: "#0c1530",
          border: "1px solid rgba(255,255,255,0.1)",
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 600 },
      },
    },
  },
});
