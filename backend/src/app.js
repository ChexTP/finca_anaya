import express from "express";
import cors from "cors";
import morgan from "morgan";
import { ALLOWED_ORIGINS } from "./config.js";
import { requestDebugLogger } from "./middlewares/debug.middleware.js";

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
import managementRoutes from "./routes/management.routes.js";
import laboratoryRoutes from "./routes/laboratory.routes.js";
import codeCountersRoutes from "./routes/codeCounters.routes.js";

const app = express();

const corsOptions = {
  origin(origin, callback) {
    // Las peticiones internas, health checks y herramientas sin Origin deben pasar.
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`Origen no permitido por CORS: ${origin}`));
  },
  credentials: true,
};

app.use(morgan("dev"));
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(requestDebugLogger);
app.use(express.json({ limit: "6mb" }));

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
app.use("/api/management", managementRoutes);
app.use("/api/laboratory", laboratoryRoutes);
app.use("/api/backups", backupsRoutes);
app.use("/api/documents", documentsRoutes);
app.use("/api/code-counters", codeCountersRoutes);

// Respuesta estandar para rutas que no existen.
app.use((req, res) => {
  res.status(404).json({ message: "Ruta no encontrada" });
});

export default app;
