import { verifyJwt } from "../utils/jwt.js";

export function auth(req, res, next) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!token) return res.status(401).json({ message: "Unauthorized" });

  try {
    req.user = verifyJwt(token); // { user_id, role, school_id }
    next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
}
