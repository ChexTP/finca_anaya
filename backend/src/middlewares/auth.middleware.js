import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config.js";

export const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.replace("Bearer ", "")
    : null;

  if (!token) {
    return res.status(401).json({ message: "Token requerido" });
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (error) {
    res.status(401).json({ message: "Token invalido o vencido" });
  }
};

export const requireRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: "No tiene permisos para esta accion" });
    }

    next();
  };
};
