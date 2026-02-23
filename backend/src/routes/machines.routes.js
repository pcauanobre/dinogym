import { Router } from "express";
import prisma from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { wrap } from "../utils/asyncHandler.js";

const router = Router();

// Listar máquinas do usuário
router.get("/", requireAuth, wrap(async (req, res) => {
  const machines = await prisma.machine.findMany({
    where: { userId: req.user.id },
    orderBy: { category: "asc" },
  });
  res.json(machines);
}));

// Criar máquina
router.post("/", requireAuth, wrap(async (req, res) => {
  const { name, category, photoBase64, currentPR } = req.body;
  if (!name || !category) return res.status(400).json({ error: "name e category são obrigatórios" });

  const machine = await prisma.machine.create({
    data: { name, category, photoBase64, currentPR, userId: req.user.id },
  });
  res.status(201).json(machine);
}));

// Buscar máquina por id
router.get("/:id", requireAuth, wrap(async (req, res) => {
  const machine = await prisma.machine.findFirst({
    where: { id: req.params.id, userId: req.user.id },
  });
  if (!machine) return res.status(404).json({ error: "Máquina não encontrada" });
  res.json(machine);
}));

// Atualizar máquina (nome, foto, PR)
router.patch("/:id", requireAuth, wrap(async (req, res) => {
  const { name, category, photoBase64, currentPR } = req.body;
  const machine = await prisma.machine.updateMany({
    where: { id: req.params.id, userId: req.user.id },
    data: { name, category, photoBase64, currentPR },
  });
  if (machine.count === 0) return res.status(404).json({ error: "Máquina não encontrada" });
  const updated = await prisma.machine.findUnique({ where: { id: req.params.id } });
  res.json(updated);
}));

// Favoritar / desfavoritar máquina
router.patch("/:id/favorite", requireAuth, wrap(async (req, res) => {
  const machine = await prisma.machine.findFirst({ where: { id: req.params.id, userId: req.user.id } });
  if (!machine) return res.status(404).json({ error: "Exercício não encontrado" });
  const updated = await prisma.machine.update({
    where: { id: req.params.id },
    data: { isFavorite: !machine.isFavorite },
  });
  res.json(updated);
}));

// Deletar máquina
router.delete("/:id", requireAuth, wrap(async (req, res) => {
  await prisma.machine.deleteMany({ where: { id: req.params.id, userId: req.user.id } });
  res.json({ ok: true });
}));

export default router;
