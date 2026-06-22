import express from "express";
import cors from "cors";
import morgan from "morgan";
import { ALLOWED_ORIGINS } from "./config.js";

import healthRoutes from "./routes/health.routes.js";
import authRoutes from "./routes/auth.routes.js";
import usersRoutes from "./routes/users.routes.js";
import catalogsRoutes from "./routes/catalogs.routes.js";
import suppliersRoutes from "./routes/suppliers.routes.js";
import clientsRoutes from "./routes/clients.routes.js";
import lotsRoutes from "./routes/lots.routes.js";
import inventoryRoutes from "./routes/inventory.routes.js";
import processesRoutes from "./routes/processes.routes.js";
import quotesRoutes from "./routes/quotes.routes.js";
import salesRoutes from "./routes/sales.routes.js";
import payablesRoutes from "./routes/payables.routes.js";
import samplesRoutes from "./routes/samples.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import reportsRoutes from "./routes/reports.routes.js";
import backupsRoutes from "./routes/backups.routes.js";
import documentsRoutes from "./routes/documents.routes.js";

const app = express();

app.use(morgan("dev"));
app.use(express.json());
app.use(
  cors({
    origin: ALLOWED_ORIGINS,
    credentials: true,
  })
);

app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/catalogs", catalogsRoutes);
app.use("/api/suppliers", suppliersRoutes);
app.use("/api/clients", clientsRoutes);
app.use("/api/lots", lotsRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/processes", processesRoutes);
app.use("/api/quotes", quotesRoutes);
app.use("/api/sales", salesRoutes);
app.use("/api/payables", payablesRoutes);
app.use("/api/samples", samplesRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/backups", backupsRoutes);
app.use("/api/documents", documentsRoutes);

// Respuesta estandar para rutas que no existen.
app.use((req, res) => {
  res.status(404).json({ message: "Ruta no encontrada" });
});

export default app;
