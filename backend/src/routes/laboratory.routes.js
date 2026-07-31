import { Router } from "express";
import { getLaboratoryHistory } from "../controllers/laboratory.controller.js";
import { requireAuth, requireRoles } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/history", requireAuth, requireRoles("admin", "accounting", "laboratory"), getLaboratoryHistory);

export default router;
