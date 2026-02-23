import "dotenv/config";
import express from "express";
import cors from "cors";
import morgan from "morgan";

import authRoutes from "./routes/auth.routes.js";
import machinesRoutes from "./routes/machines.routes.js";
import sessionsRoutes from "./routes/sessions.routes.js";
import routineRoutes from "./routes/routine.routes.js";
import usersRoutes from "./routes/users.routes.js";

const app = express();

app.use(morgan("dev"));
app.use(express.json({ limit: "20mb" }));

const allowed = process.env.CORS_ORIGINS || "http://localhost:5173";
app.use(
  cors({
    origin: allowed.split(",").map((s) => s.trim()),
    credentials: true,
  })
);

app.get("/health", (req, res) => res.json({ ok: true }));

app.use("/auth", authRoutes);
app.use("/machines", machinesRoutes);
app.use("/sessions", sessionsRoutes);
app.use("/routine", routineRoutes);
app.use("/users", usersRoutes);

// Global error handler — captura erros passados via next(err) nas rotas
app.use((err, req, res, _next) => {
  console.error("API error:", err?.message || err);
  res.status(503).json({ error: "Service unavailable" });
});

// Evita que unhandled rejections de rotas async matem o processo
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason?.message || reason);
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`✅ DinoGym API rodando em http://localhost:${PORT}`));
