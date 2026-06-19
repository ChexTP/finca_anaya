import express from "express";
import cors from "cors";
import morgan from "morgan";
import { FRONTEND_URL } from "./config.js";

import healthRoutes from "./routes/health.routes.js";
import authRoutes from "./routes/auth.routes.js";
import usersRoutes from "./routes/users.routes.js";
import catalogsRoutes from "./routes/catalogs.routes.js";
import suppliersRoutes from "./routes/suppliers.routes.js";
import lotsRoutes from "./routes/lots.routes.js";
import inventoryRoutes from "./routes/inventory.routes.js";

const app = express();

app.use(morgan("dev"));
app.use(express.json());
app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
  })
);

app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/catalogs", catalogsRoutes);
app.use("/api/suppliers", suppliersRoutes);
app.use("/api/lots", lotsRoutes);
app.use("/api/inventory", inventoryRoutes);

// Respuesta estandar para rutas que no existen.
app.use((req, res) => {
  res.status(404).json({ message: "Ruta no encontrada" });
});

export default app;
