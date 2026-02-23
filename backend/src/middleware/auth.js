import jwt from "jsonwebtoken";

export function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return res.status(401).json({ message: "Token ausente." });

  try {
    const payload = jwt.verify(auth.slice(7), process.env.JWT_SECRET);
    req.user = { ...payload, id: payload.sub };
    next();
  } catch {
    return res.status(401).json({ message: "Token inválido." });
  }
}

export function requireRole(role) {
  return (req, res, next) => {
    if (req.user?.role !== role) return res.status(403).json({ message: "Acesso negado." });
    next();
  };
}
