import { useState, useEffect } from "react";
import {
  Box, Typography, Button, Stack, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Chip, IconButton, InputAdornment, ToggleButtonGroup, ToggleButton, Divider,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AddIcon from "@mui/icons-material/Add";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import PersonIcon from "@mui/icons-material/Person";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import { useNavigate } from "react-router-dom";
import api from "../utils/api.js";
import BottomNav from "../components/BottomNav.jsx";
import { PAGE_BG } from "../constants/theme.js";

export default function Usuarios() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [detailUser, setDetailUser] = useState(null);

  const [nome, setNome] = useState("");
  const [role, setRole] = useState("MEMBER");
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");
  const [senha, setSenha] = useState("");
  const [showSenha, setShowSenha] = useState(false);

  useEffect(() => { fetchUsers(); }, []);

  async function fetchUsers() {
    setLoading(true);
    try {
      const res = await api.get("/users");
      setUsers(res.data);
    } catch {
      // silencioso
    } finally {
      setLoading(false);
    }
  }

  function openDialog() {
    setNome(""); setRole("MEMBER"); setEmail(""); setCpf(""); setSenha("");
    setError(""); setShowSenha(false);
    setOpen(true);
  }

  function formatCpf(value) {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    return digits
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
  }

  async function handleCreate() {
    setError("");
    if (!nome.trim() || !senha.trim()) {
      setError("Nome e senha são obrigatórios.");
      return;
    }
    if (role === "ADMIN" && !email.trim()) {
      setError("Admin precisa de email.");
      return;
    }
    if (role === "MEMBER" && cpf.replace(/\D/g, "").length !== 11) {
      setError("CPF inválido (11 dígitos).");
      return;
    }
    setSaving(true);
    try {
      await api.post("/users", {
        name: nome.trim(),
        role,
        email: role === "ADMIN" ? email.trim() : undefined,
        cpf: role === "MEMBER" ? cpf : undefined,
        password: senha,
      });
      setOpen(false);
      fetchUsers();
    } catch (err) {
      setError(err?.response?.data?.message || "Erro ao criar usuário.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Box sx={{ minHeight: "100vh", background: PAGE_BG, pb: 10 }}>
      {/* Header */}
      <Box
        sx={{
          position: "sticky", top: 0, zIndex: 50,
          bgcolor: "rgba(5,11,29,0.85)", backdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          px: 2, py: 1.5,
          display: "flex", alignItems: "center", gap: 1.5,
        }}
      >
        <IconButton size="small" onClick={() => navigate("/app")} sx={{ color: "rgba(255,255,255,0.6)" }}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h6" fontWeight={700} sx={{ flex: 1 }}>
          Usuários
        </Typography>
        <Button
          size="small"
          startIcon={<AddIcon />}
          onClick={openDialog}
          sx={{
            bgcolor: "#22c55e", color: "#000", fontWeight: 700,
            borderRadius: "8px", px: 1.5,
            "&:hover": { bgcolor: "#16a34a" },
          }}
        >
          Novo
        </Button>
      </Box>

      {/* Lista */}
      <Box sx={{ px: 2, pt: 2, maxWidth: "sm", mx: "auto" }}>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", pt: 6 }}>
            <CircularProgress sx={{ color: "#22c55e" }} />
          </Box>
        ) : users.length === 0 ? (
          <Typography color="text.secondary" textAlign="center" pt={6}>
            Nenhum usuário encontrado.
          </Typography>
        ) : (
          <Stack spacing={1.5}>
            {users.map((u) => (
              <Box
                key={u.id}
                onClick={() => setDetailUser(u)}
                sx={{
                  p: 2, borderRadius: 2,
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "rgba(255,255,255,0.03)",
                  display: "flex", alignItems: "center", gap: 1.5,
                  cursor: "pointer",
                  "&:active": { opacity: 0.7 },
                  "&:hover": { background: "rgba(255,255,255,0.06)" },
                }}
              >
                <Box
                  sx={{
                    width: 40, height: 40, borderRadius: "50%",
                    bgcolor: u.role === "ADMIN" ? "rgba(234,179,8,0.15)" : "rgba(34,197,94,0.15)",
                    border: `1px solid ${u.role === "ADMIN" ? "rgba(234,179,8,0.3)" : "rgba(34,197,94,0.3)"}`,
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}
                >
                  {u.role === "ADMIN"
                    ? <AdminPanelSettingsIcon sx={{ fontSize: 20, color: "#eab308" }} />
                    : <PersonIcon sx={{ fontSize: 20, color: "#22c55e" }} />
                  }
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography fontWeight={600} noWrap>{u.name}</Typography>
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {u.email || (u.cpf ? u.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") : "—")}
                  </Typography>
                </Box>
                <Chip
                  label={u.role === "ADMIN" ? "Admin" : "Membro"}
                  size="small"
                  sx={{
                    bgcolor: u.role === "ADMIN" ? "rgba(234,179,8,0.15)" : "rgba(34,197,94,0.12)",
                    color: u.role === "ADMIN" ? "#eab308" : "#22c55e",
                    fontWeight: 600, fontSize: "0.7rem",
                    border: `1px solid ${u.role === "ADMIN" ? "rgba(234,179,8,0.25)" : "rgba(34,197,94,0.2)"}`,
                  }}
                />
              </Box>
            ))}
          </Stack>
        )}
      </Box>

      {/* Dialog criar usuário */}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        fullWidth
        maxWidth="xs"
        PaperProps={{
          sx: {
            bgcolor: "#071a12",
            backgroundImage: "none",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 2,
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>Novo Usuário</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Stack spacing={2}>
            <ToggleButtonGroup
              exclusive
              value={role}
              onChange={(_, v) => { if (v) setRole(v); }}
              fullWidth
              size="small"
              sx={{ mt: 1 }}
            >
              <ToggleButton
                value="MEMBER"
                sx={{
                  flex: 1, fontWeight: 600,
                  "&.Mui-selected": { bgcolor: "rgba(34,197,94,0.15)", color: "#22c55e", borderColor: "rgba(34,197,94,0.3)" },
                }}
              >
                Membro
              </ToggleButton>
              <ToggleButton
                value="ADMIN"
                sx={{
                  flex: 1, fontWeight: 600,
                  "&.Mui-selected": { bgcolor: "rgba(234,179,8,0.15)", color: "#eab308", borderColor: "rgba(234,179,8,0.3)" },
                }}
              >
                Admin
              </ToggleButton>
            </ToggleButtonGroup>

            <TextField
              label="Nome completo"
              fullWidth
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              size="small"
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: "8px" } }}
            />

            {role === "ADMIN" ? (
              <TextField
                label="Email"
                type="email"
                fullWidth
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                size="small"
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: "8px" } }}
              />
            ) : (
              <TextField
                label="CPF"
                fullWidth
                value={cpf}
                onChange={(e) => setCpf(formatCpf(e.target.value))}
                size="small"
                inputProps={{ inputMode: "numeric" }}
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: "8px" } }}
              />
            )}

            <TextField
              label="Senha"
              type={showSenha ? "text" : "password"}
              fullWidth
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              size="small"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setShowSenha((s) => !s)} edge="end">
                      {showSenha ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: "8px" } }}
            />

            {error && (
              <Typography variant="body2" sx={{ color: "rgba(248,113,113,0.95)" }}>
                {error}
              </Typography>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button
            onClick={() => setOpen(false)}
            sx={{ color: "rgba(255,255,255,0.5)", fontWeight: 600 }}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleCreate}
            disabled={saving}
            sx={{
              bgcolor: "#22c55e", color: "#000", fontWeight: 700, borderRadius: "8px", px: 2,
              "&:hover": { bgcolor: "#16a34a" },
              "&.Mui-disabled": { bgcolor: "rgba(34,197,94,0.3)", color: "rgba(0,0,0,0.4)" },
            }}
          >
            {saving ? <CircularProgress size={18} sx={{ color: "#000" }} /> : "Criar"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: detalhes da conta do usuário */}
      {detailUser && (
        <Dialog
          open={!!detailUser}
          onClose={() => setDetailUser(null)}
          fullWidth
          maxWidth="xs"
          PaperProps={{
            sx: {
              bgcolor: "#071a12",
              backgroundImage: "none",
              borderRadius: 2,
            },
          }}
        >
          <DialogContent sx={{ pt: 3, pb: 2 }}>
            {/* Avatar */}
            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", mb: 2.5 }}>
              <Box sx={{
                width: 64, height: 64, borderRadius: "50%",
                bgcolor: detailUser.role === "ADMIN" ? "rgba(234,179,8,0.15)" : "rgba(34,197,94,0.15)",
                border: `2px solid ${detailUser.role === "ADMIN" ? "rgba(234,179,8,0.4)" : "rgba(34,197,94,0.4)"}`,
                display: "flex", alignItems: "center", justifyContent: "center", mb: 1.5,
              }}>
                <Typography fontSize="1.5rem" fontWeight={800}
                  color={detailUser.role === "ADMIN" ? "#eab308" : "#22c55e"}>
                  {detailUser.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
                </Typography>
              </Box>
              <Typography fontWeight={800} fontSize="1.05rem">{detailUser.name}</Typography>
              <Chip
                label={detailUser.role === "ADMIN" ? "Admin" : "Membro"}
                size="small"
                sx={{
                  mt: 0.5,
                  bgcolor: detailUser.role === "ADMIN" ? "rgba(234,179,8,0.15)" : "rgba(34,197,94,0.12)",
                  color: detailUser.role === "ADMIN" ? "#eab308" : "#22c55e",
                  fontWeight: 700, fontSize: "0.72rem",
                  border: `1px solid ${detailUser.role === "ADMIN" ? "rgba(234,179,8,0.3)" : "rgba(34,197,94,0.25)"}`,
                }}
              />
            </Box>

            <Divider sx={{ borderColor: "rgba(255,255,255,0.07)", mb: 2 }} />

            <Stack spacing={1.5}>
              {detailUser.email && (
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={700} letterSpacing={0.5}>EMAIL</Typography>
                  <Typography fontWeight={600} fontSize="0.9rem">{detailUser.email}</Typography>
                </Box>
              )}
              {detailUser.cpf && (
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={700} letterSpacing={0.5}>CPF</Typography>
                  <Typography fontWeight={600} fontSize="0.9rem">
                    {detailUser.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}
                  </Typography>
                </Box>
              )}
              <Box>
                <Typography variant="caption" color="text.secondary" fontWeight={700} letterSpacing={0.5}>STATUS</Typography>
                <Stack direction="row" alignItems="center" spacing={0.8} mt={0.3}>
                  <Box sx={{
                    width: 8, height: 8, borderRadius: "50%",
                    bgcolor: detailUser.firstAccessDone ? "#22c55e" : "#facc15",
                    boxShadow: detailUser.firstAccessDone ? "0 0 6px #22c55e" : "0 0 6px #facc15",
                  }} />
                  <Typography fontWeight={600} fontSize="0.9rem"
                    color={detailUser.firstAccessDone ? "#22c55e" : "#facc15"}>
                    {detailUser.firstAccessDone ? "Ativo" : "Pendente primeiro acesso"}
                  </Typography>
                </Stack>
              </Box>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ justifyContent: "center", pb: 2.5 }}>
            <Button
              variant="outlined"
              onClick={() => setDetailUser(null)}
              sx={{ px: 4, py: 1, fontWeight: 700, borderColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.7)" }}
            >
              Fechar
            </Button>
          </DialogActions>
        </Dialog>
      )}

      <BottomNav />
    </Box>
  );
}
