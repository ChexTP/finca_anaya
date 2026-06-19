import { config } from "dotenv";

config();

export const PORT = process.env.PORT || 4000;
export const DATABASE_URL = process.env.DATABASE_URL;
export const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";
export const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
