import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Box, Button, Checkbox, Container, FormControlLabel,
  IconButton, InputAdornment, TextField, Typography, CircularProgress,
} from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import { supabase } from "../supabaseClient.js";
import { getToken, getKeepSession, setKeepSession as persistKeepSession } from "../utils/authStorage.js";
import { useEffect } from "react";

export default function Login() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [keepSession, setKeepSession] = useState(() => getKeepSession());
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (getToken()) nav("/app", { replace: true });
  }, []);

  useEffect(() => { persistKeepSession(keepSession); }, [keepSession]);

  async function onSubmit(e) {
    e.preventDefault();
    setMsg("");
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      nav("/app", { replace: true });
    } catch (err) {
      setMsg(err?.message || "Email ou senha inválidos.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        px: 2,
        background: "radial-gradient(800px 400px at 50% -10%, rgba(34,197,94,0.2), transparent 60%), linear-gradient(135deg, #0a0a0a, #0f1a0f)",
      }}
    >
      <Container maxWidth="xs">
        <Box sx={{ textAlign: "center", mb: 3 }}>
          <Typography variant="h4" sx={{ fontWeight: 900, color: "#22c55e", letterSpacing: 2 }}>
            DINOGYM
          </Typography>
          <Typography variant="body2" color="text.secondary">Acesso ao painel</Typography>
        </Box>

        <Box
          component="form"
          onSubmit={onSubmit}
          sx={{
            p: 3,
            borderRadius: 2,
            border: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(255,255,255,0.03)",
            backdropFilter: "blur(10px)",
          }}
        >
          <TextField
            fullWidth
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            margin="normal"
            autoComplete="email"
            sx={{ "& .MuiOutlinedInput-root": { borderRadius: "8px" } }}
          />

          <TextField
            fullWidth
            label="Senha"
            type={show ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            margin="normal"
            autoComplete="current-password"
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setShow((s) => !s)} edge="end">
                    {show ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
            sx={{ "& .MuiOutlinedInput-root": { borderRadius: "8px" } }}
          />

          <FormControlLabel
            control={
              <Checkbox
                checked={keepSession}
                onChange={(_, c) => setKeepSession(c)}
                sx={{ color: "rgba(255,255,255,0.5)", "&.Mui-checked": { color: "#22c55e" } }}
              />
            }
            label={<Typography sx={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>Manter sessão</Typography>}
            sx={{ mt: 0.5 }}
          />

          {msg && (
            <Typography variant="body2" sx={{ mt: 1, color: "rgba(248,113,113,0.95)" }}>
              {msg}
            </Typography>
          )}

          <Button
            type="submit"
            fullWidth
            disabled={!email || !password || loading}
            sx={{
              mt: 2, py: 1.3, fontWeight: 700, borderRadius: "8px",
              bgcolor: "#22c55e", color: "#000",
              "&:hover": { bgcolor: "#16a34a" },
              "&.Mui-disabled": { bgcolor: "rgba(34,197,94,0.3)", color: "rgba(0,0,0,0.4)" },
            }}
          >
            {loading ? <CircularProgress size={20} sx={{ color: "#000" }} /> : "Entrar"}
          </Button>

          <Typography variant="body2" color="text.secondary" textAlign="center" mt={2}>
            Não tem conta?{" "}
            <Typography
              component={Link}
              to="/register"
              variant="body2"
              sx={{ color: "#22c55e", fontWeight: 700, textDecoration: "none", "&:hover": { textDecoration: "underline" } }}
            >
              Criar conta
            </Typography>
          </Typography>
        </Box>
      </Container>
    </Box>
  );
}
