import { Router } from "express";
import { getProductionReport } from "../controllers/management.controller.js";
import { requireAuth, requireRoles } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/production-report", requireAuth, requireRoles("admin", "accounting", "management"), getProductionReport);

export default router;
