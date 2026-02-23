import { Router } from "express";
import prisma from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { wrap } from "../utils/asyncHandler.js";

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

export default router;
