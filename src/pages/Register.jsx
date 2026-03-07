import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Box, Button, Container, IconButton, InputAdornment,
  TextField, Typography, CircularProgress,
} from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import { supabase } from "../supabaseClient.js";
import { getToken } from "../utils/authStorage.js";

export default function Register() {
  const nav = useNavigate();
  const [name, setName]         = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [showCf, setShowCf]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [msg, setMsg]           = useState("");

  useEffect(() => {
    if (getToken()) nav("/app", { replace: true });
  }, []);

  async function onSubmit(e) {
    e.preventDefault();
    setMsg("");

    if (password.length < 6) {
      setMsg("Senha deve ter no mínimo 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      setMsg("As senhas não coincidem.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { data: { name } },
      });
      if (error) throw error;
      // Create default exercises and routine for the new user
      await supabase.rpc("create_default_exercises");
      await supabase.rpc("create_default_routine");
      nav("/app", { replace: true });
    } catch (err) {
      setMsg(err?.message || "Erro ao criar conta. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  const canSubmit = name.trim() && email.trim() && password && confirm && !loading;

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
          <Typography variant="body2" color="text.secondary">Criar conta</Typography>
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
            label="Nome completo"
            value={name}
            onChange={(e) => setName(e.target.value)}
            margin="normal"
            autoComplete="name"
            sx={{ "& .MuiOutlinedInput-root": { borderRadius: "8px" } }}
          />

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
            type={showPw ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            margin="normal"
            autoComplete="new-password"
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setShowPw((s) => !s)} edge="end">
                    {showPw ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
            sx={{ "& .MuiOutlinedInput-root": { borderRadius: "8px" } }}
          />

          <TextField
            fullWidth
            label="Confirmar senha"
            type={showCf ? "text" : "password"}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            margin="normal"
            autoComplete="new-password"
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setShowCf((s) => !s)} edge="end">
                    {showCf ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
            sx={{ "& .MuiOutlinedInput-root": { borderRadius: "8px" } }}
          />

          {msg && (
            <Typography variant="body2" sx={{ mt: 1, color: "rgba(248,113,113,0.95)" }}>
              {msg}
            </Typography>
          )}

          <Button
            type="submit"
            fullWidth
            disabled={!canSubmit}
            sx={{
              mt: 2, py: 1.3, fontWeight: 700, borderRadius: "8px",
              bgcolor: "#22c55e", color: "#000",
              "&:hover": { bgcolor: "#16a34a" },
              "&.Mui-disabled": { bgcolor: "rgba(34,197,94,0.3)", color: "rgba(0,0,0,0.4)" },
            }}
          >
            {loading ? <CircularProgress size={20} sx={{ color: "#000" }} /> : "Criar conta"}
          </Button>

          <Typography variant="body2" color="text.secondary" textAlign="center" mt={2}>
            Já tem conta?{" "}
            <Typography
              component={Link}
              to="/login"
              variant="body2"
              sx={{ color: "#22c55e", fontWeight: 700, textDecoration: "none", "&:hover": { textDecoration: "underline" } }}
            >
              Entrar
            </Typography>
          </Typography>
        </Box>
      </Container>
    </Box>
  );
}
