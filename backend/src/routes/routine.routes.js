import { Router } from "express";
import prisma from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { wrap } from "../utils/asyncHandler.js";

const router = Router();

// Retorna rotina completa (7 dias + exercícios)
router.get("/", requireAuth, wrap(async (req, res) => {
  const days = await prisma.routineDay.findMany({
    where: { userId: req.user.id },
    include: {
      exercises: {
        include: { machine: { select: { id: true, name: true, category: true, currentPR: true } } },
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: { dayOfWeek: "asc" },
  });
  res.json(days);
}));

// Retorna rotina de um dia específico
router.get("/day/:dayOfWeek", requireAuth, wrap(async (req, res) => {
  const dayOfWeek = parseInt(req.params.dayOfWeek);
  const day = await prisma.routineDay.findUnique({
    where: { userId_dayOfWeek: { userId: req.user.id, dayOfWeek } },
    include: {
      exercises: {
        include: { machine: { select: { id: true, name: true, category: true, currentPR: true } } },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
  res.json(day);
}));

// Salvar rotina de um dia (substitui tudo)
router.put("/day/:dayOfWeek", requireAuth, wrap(async (req, res) => {
  const dayOfWeek = parseInt(req.params.dayOfWeek);
  const { exercises, label } = req.body; // [{ machineId, sets, reps }], label?

  if (dayOfWeek < 0 || dayOfWeek > 6)
    return res.status(400).json({ error: "dayOfWeek deve ser 0-6" });

  // Se sem exercícios, deleta o dia
  if (!exercises || exercises.length === 0) {
    await prisma.routineDay.deleteMany({ where: { userId: req.user.id, dayOfWeek } });
    return res.json({ ok: true });
  }

  const day = await prisma.routineDay.upsert({
    where: { userId_dayOfWeek: { userId: req.user.id, dayOfWeek } },
    update: { ...(label !== undefined && { label }) },
    create: { userId: req.user.id, dayOfWeek, ...(label != null && { label }) },
  });

  // Deleta exercícios antigos e cria novos
  await prisma.routineExercise.deleteMany({ where: { routineDayId: day.id } });
  await prisma.routineExercise.createMany({
    data: exercises.map((ex, i) => ({
      routineDayId: day.id,
      machineId: ex.machineId,
      sets: ex.sets || 3,
      reps: ex.reps || 12,
      repsMax: ex.repsMax ?? null,
      sortOrder: i,
    })),
  });

  const result = await prisma.routineDay.findUnique({
    where: { id: day.id },
    include: {
      exercises: {
        include: { machine: { select: { id: true, name: true, category: true, currentPR: true } } },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
  res.json(result);
}));

// GET modelos do usuário
router.get("/templates", requireAuth, wrap(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { routineTemplates: true } });
  res.json(Array.isArray(user?.routineTemplates) ? user.routineTemplates : []);
}));

// Salva todos os modelos de uma vez (substitui)
router.put("/templates", requireAuth, wrap(async (req, res) => {
  const { templates } = req.body;
  if (!Array.isArray(templates)) return res.status(400).json({ error: "templates deve ser array" });
  await prisma.user.update({ where: { id: req.user.id }, data: { routineTemplates: templates } });
  res.json({ ok: true });
}));

export default router;
