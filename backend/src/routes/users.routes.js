import { Router } from "express";
import bcrypt from "bcryptjs";
import prisma from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { wrap } from "../utils/asyncHandler.js";
import { createDefaultExercises } from "../utils/defaultExercises.js";
import { createDefaultRoutine } from "../utils/defaultRoutine.js";

const router = Router();

// GET /users/me
router.get("/me", requireAuth, wrap(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { id: true, name: true, email: true, role: true, photoBase64: true },
  });
  res.json(user);
}));

// PATCH /users/me — atualiza foto de perfil
router.patch("/me", requireAuth, wrap(async (req, res) => {
  const { photoBase64 } = req.body;
  const user = await prisma.user.update({
    where: { id: req.user.id },
    data: { photoBase64: photoBase64 ?? undefined },
    select: { id: true, name: true, email: true, role: true, photoBase64: true },
  });
  res.json(user);
}));

// GET /users — lista todos os usuários (admin only)
router.get("/", requireAuth, requireRole("ADMIN"), wrap(async (req, res) => {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, cpf: true, role: true, firstAccessDone: true },
    orderBy: { name: "asc" },
  });
  res.json(users);
}));

// POST /users — cria usuário (admin only)
router.post("/", requireAuth, requireRole("ADMIN"), wrap(async (req, res) => {
  const { name, email, cpf, password, role } = req.body || {};

  if (!name || !password) {
    return res.status(400).json({ message: "Nome e senha são obrigatórios." });
  }
  if (!["ADMIN", "MEMBER"].includes(role)) {
    return res.status(400).json({ message: "Tipo inválido." });
  }
  if (role === "ADMIN" && !email) {
    return res.status(400).json({ message: "Admin precisa de email." });
  }
  if (role === "MEMBER" && !cpf) {
    return res.status(400).json({ message: "Membro precisa de CPF." });
  }

  const cpfNorm = cpf ? String(cpf).replace(/\D/g, "") : undefined;

  if (email) {
    const exists = await prisma.user.findUnique({ where: { email: String(email) } });
    if (exists) return res.status(409).json({ message: "Email já cadastrado." });
  }
  if (cpfNorm) {
    const exists = await prisma.user.findUnique({ where: { cpf: cpfNorm } });
    if (exists) return res.status(409).json({ message: "CPF já cadastrado." });
  }

  const passwordHash = await bcrypt.hash(String(password), 10);

  const newUser = await prisma.user.create({
    data: {
      name: String(name),
      email: email ? String(email) : undefined,
      cpf: cpfNorm || undefined,
      passwordHash,
      role,
      firstAccessDone: true,
    },
    select: { id: true, name: true, email: true, cpf: true, role: true },
  });

  if (role === "MEMBER") {
    await createDefaultExercises(newUser.id, prisma);
    await createDefaultRoutine(newUser.id, prisma);
  }

  res.status(201).json(newUser);
}));

export default router;
