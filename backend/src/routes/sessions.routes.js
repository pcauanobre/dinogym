import { Router } from "express";
import prisma from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { wrap } from "../utils/asyncHandler.js";

const router = Router();

// Sessão de hoje (se existir)
router.get("/today", requireAuth, wrap(async (req, res) => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  const session = await prisma.workoutSession.findFirst({
    where: { userId: req.user.id, date: { gte: start, lte: end } },
    include: {
      entries: { include: { machine: true }, orderBy: { createdAt: "asc" } },
    },
  });
  res.json(session);
}));

// Iniciar sessão do dia (aceita date opcional para sync offline)
router.post("/", requireAuth, wrap(async (req, res) => {
  const { date: dateParam } = req.body;
  const refDate = dateParam ? new Date(dateParam) : new Date();

  const start = new Date(refDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(refDate);
  end.setHours(23, 59, 59, 999);

  const existing = await prisma.workoutSession.findFirst({
    where: { userId: req.user.id, date: { gte: start, lte: end } },
    include: { entries: { include: { machine: true }, orderBy: { createdAt: "asc" } } },
  });
  if (existing) return res.json(existing);

  const session = await prisma.workoutSession.create({
    data: { userId: req.user.id, ...(dateParam && { date: new Date(dateParam) }), startedAt: new Date() },
    include: { entries: true },
  });
  res.status(201).json(session);
}));

// Finalizar sessão (dayRating + nutrition)
router.patch("/:id/finish", requireAuth, wrap(async (req, res) => {
  const { dayRating, nutrition, duration } = req.body;
  const session = await prisma.workoutSession.updateMany({
    where: { id: req.params.id, userId: req.user.id },
    data: { dayRating, nutrition, finished: true, finishedAt: new Date(), ...(duration != null && { duration }) },
  });
  if (session.count === 0) return res.status(404).json({ error: "Sessão não encontrada" });
  const updated = await prisma.workoutSession.findUnique({
    where: { id: req.params.id },
    include: { entries: { include: { machine: true } } },
  });
  res.json(updated);
}));

// Adicionar entrada (máquina + peso + sets + reps + PR)
router.post("/:id/entries", requireAuth, wrap(async (req, res) => {
  const { machineId, weight, sets, reps, hitPR, notes, setsData: setsDataParam, comment } = req.body;
  if (!machineId || weight === undefined)
    return res.status(400).json({ error: "machineId e weight são obrigatórios" });

  const sessionRow = await prisma.workoutSession.findFirst({ where: { id: req.params.id, userId: req.user.id } });
  if (!sessionRow) return res.status(404).json({ error: "Sessão não encontrada" });

  const machine = await prisma.machine.findFirst({
    where: { id: machineId, userId: req.user.id },
  });
  if (!machine) return res.status(404).json({ error: "Máquina não encontrada" });

  const previousPR = machine.currentPR;

  const entry = await prisma.workoutEntry.create({
    data: {
      sessionId: req.params.id,
      machineId,
      weight,
      sets: sets || null,
      reps: reps || null,
      hitPR: !!hitPR,
      previousPR,
      notes,
      setsData: setsDataParam ? JSON.stringify(setsDataParam) : null,
      comment: comment || null,
    },
    include: { machine: true },
  });

  res.status(201).json(entry);
}));

// Deletar sessão de hoje (para limpeza de testes/simulação)
router.delete("/today", requireAuth, wrap(async (req, res) => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  const session = await prisma.workoutSession.findFirst({
    where: { userId: req.user.id, date: { gte: start, lte: end } },
  });
  if (!session) return res.json({ ok: true });

  await prisma.workoutEntry.deleteMany({ where: { sessionId: session.id } });
  await prisma.workoutSession.delete({ where: { id: session.id } });
  res.json({ ok: true });
}));

// Atualizar entrada do histórico (edição retroativa)
router.patch("/:sessionId/entries/:entryId", requireAuth, wrap(async (req, res) => {
  const { weight, reps, sets, setsData: sdsParam, comment } = req.body;
  const session = await prisma.workoutSession.findFirst({
    where: { id: req.params.sessionId, userId: req.user.id },
  });
  if (!session) return res.status(404).json({ error: "Sessão não encontrada" });
  const entry = await prisma.workoutEntry.findFirst({
    where: { id: req.params.entryId, sessionId: req.params.sessionId },
  });
  if (!entry) return res.status(404).json({ error: "Entrada não encontrada" });
  const updated = await prisma.workoutEntry.update({
    where: { id: req.params.entryId },
    data: {
      ...(weight   !== undefined && { weight }),
      ...(reps     !== undefined && { reps }),
      ...(sets     !== undefined && { sets }),
      ...(sdsParam !== undefined && { setsData: JSON.stringify(sdsParam) }),
      ...(comment  !== undefined && { comment }),
    },
    include: { machine: true },
  });
  res.json(updated);
}));

// Status: tem máquinas? tem rotina?
router.get("/status", requireAuth, wrap(async (req, res) => {
  const [machineCount, routineCount] = await Promise.all([
    prisma.machine.count({ where: { userId: req.user.id } }),
    prisma.routineDay.count({ where: { userId: req.user.id } }),
  ]);
  res.json({ hasMachines: machineCount > 0, hasRoutine: routineCount > 0 });
}));

// Histórico dos últimos treinos
router.get("/history", requireAuth, wrap(async (req, res) => {
  const sessions = await prisma.workoutSession.findMany({
    where: { userId: req.user.id, finished: true },
    include: { entries: { include: { machine: true }, orderBy: { createdAt: "asc" } } },
    orderBy: { date: "desc" },
    take: 30,
  });
  res.json(sessions);
}));

// Relatório mensal
router.get("/report/:year/:month", requireAuth, wrap(async (req, res) => {
  const year = parseInt(req.params.year);
  const month = parseInt(req.params.month);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59, 999);

  const sessions = await prisma.workoutSession.findMany({
    where: { userId: req.user.id, date: { gte: start, lte: end } },
    include: { entries: { include: { machine: true } } },
    orderBy: { date: "asc" },
  });

  const totalSessions = sessions.length;
  const prsBeaten = sessions.flatMap((s) => s.entries).filter((e) => e.hitPR).length;
  const rated = sessions.filter((s) => s.dayRating);
  const avgDayRating = rated.length ? rated.reduce((a, s) => a + s.dayRating, 0) / rated.length : 0;
  const fed = sessions.filter((s) => s.nutrition);
  const avgNutrition = fed.length ? fed.reduce((a, s) => a + s.nutrition, 0) / fed.length : 0;

  res.json({ sessions, totalSessions, prsBeaten, avgDayRating, avgNutrition });
}));

// Progressão de carga de uma máquina (últimas 50 sessões com essa máquina)
router.get("/machine/:machineId/progress", requireAuth, wrap(async (req, res) => {
  const entries = await prisma.workoutEntry.findMany({
    where: {
      machineId: req.params.machineId,
      session: { userId: req.user.id, finished: true },
    },
    include: { session: { select: { date: true } } },
    orderBy: { session: { date: "asc" } },
    take: 50,
  });
  res.json(entries.map((e) => ({
    date: e.session.date,
    weight: e.weight,
    sets: e.sets,
    reps: e.reps,
    hitPR: e.hitPR,
    setsData: e.setsData,
  })));
}));

export default router;
