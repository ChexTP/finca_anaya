import { config } from "dotenv";

config();

export const PORT = process.env.PORT || 4000;
export const DATABASE_URL = process.env.DATABASE_URL;
export const DATABASE_SSL = process.env.DATABASE_SSL === "true";
export const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";
export const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
export const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || `${FRONTEND_URL},http://127.0.0.1:5173`)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
