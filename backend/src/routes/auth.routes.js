import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma.js";
import { wrap } from "../utils/asyncHandler.js";
import { createDefaultExercises } from "../utils/defaultExercises.js";

const router = express.Router();

// POST /auth/login — email ou CPF + senha
router.post("/login", wrap(async (req, res) => {
  const { email, cpf, password } = req.body || {};

  let user = null;

  if (email) {
    user = await prisma.user.findUnique({ where: { email: String(email) } });
  } else if (cpf) {
    const cpfNorm = String(cpf).replace(/\D/g, "");
    user = await prisma.user.findUnique({ where: { cpf: cpfNorm } });
  } else {
    return res.status(400).json({ message: "Email ou CPF obrigatório." });
  }

  if (!user) return res.status(401).json({ message: "Usuário ou senha inválidos." });
  if (!user.firstAccessDone && user.role === "MEMBER")
    return res.status(403).json({ message: "Primeiro acesso pendente." });

  const valid = await bcrypt.compare(String(password || ""), user.passwordHash);
  if (!valid) return res.status(401).json({ message: "Usuário ou senha inválidos." });

  const token = jwt.sign(
    { sub: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

  return res.json({ token, user: { id: user.id, name: user.name, role: user.role } });
}));

// POST /auth/register — auto-cadastro com email + senha
router.post("/register", wrap(async (req, res) => {
  const { name, email, password } = req.body || {};

  if (!name || !email || !password) {
    return res.status(400).json({ message: "Nome, email e senha são obrigatórios." });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ message: "Senha deve ter no mínimo 6 caracteres." });
  }

  const exists = await prisma.user.findUnique({ where: { email: String(email) } });
  if (exists) return res.status(409).json({ message: "Email já cadastrado." });

  const passwordHash = await bcrypt.hash(String(password), 10);
  const newUser = await prisma.user.create({
    data: {
      name: String(name).trim(),
      email: String(email).trim().toLowerCase(),
      passwordHash,
      role: "MEMBER",
      firstAccessDone: true,
    },
  });

  await createDefaultExercises(newUser.id, prisma);

  const token = jwt.sign(
    { sub: newUser.id, role: newUser.role },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

  return res.status(201).json({ token, user: { id: newUser.id, name: newUser.name, role: newUser.role } });
}));

// POST /auth/primeiro-acesso/verify
router.post("/primeiro-acesso/verify", wrap(async (req, res) => {
  const { cpf } = req.body || {};
  const cpfNorm = String(cpf || "").replace(/\D/g, "");
  if (cpfNorm.length !== 11) return res.status(400).json({ message: "CPF inválido." });

  const user = await prisma.user.findUnique({ where: { cpf: cpfNorm } });
  if (!user) return res.json({ status: "not_found" });
  if (user.firstAccessDone) return res.json({ status: "already_active" });
  return res.json({ status: "pending", name: user.name });
}));

// POST /auth/primeiro-acesso/activate
router.post("/primeiro-acesso/activate", wrap(async (req, res) => {
  const { cpf, password } = req.body || {};
  const cpfNorm = String(cpf || "").replace(/\D/g, "");

  const user = await prisma.user.findUnique({ where: { cpf: cpfNorm } });
  if (!user) return res.status(404).json({ message: "CPF não encontrado." });
  if (user.firstAccessDone) return res.status(409).json({ message: "Conta já ativa." });

  const passwordHash = await bcrypt.hash(String(password), 10);
  await prisma.user.update({
    where: { cpf: cpfNorm },
    data: { passwordHash, firstAccessDone: true },
  });

  // Cria exercícios padrão para o novo usuário
  await createDefaultExercises(user.id, prisma);

  return res.json({ message: "Conta ativada com sucesso." });
}));

export default router;
