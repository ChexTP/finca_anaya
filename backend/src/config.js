import { config } from "dotenv";

config();

export const PORT = process.env.PORT || 4000;
export const DATABASE_URL = process.env.DATABASE_URL;
export const DATABASE_SSL = process.env.DATABASE_SSL === "true";
export const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";
export const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
const defaultAllowedOrigins = [
  FRONTEND_URL,
  "https://finca-anaya.vercel.app",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

export const ALLOWED_ORIGINS = [
  ...(process.env.ALLOWED_ORIGINS || "").split(","),
  ...defaultAllowedOrigins,
]
  .map((origin) => origin.trim())
  .filter(Boolean)
  .filter((origin, index, origins) => origins.indexOf(origin) === index);
