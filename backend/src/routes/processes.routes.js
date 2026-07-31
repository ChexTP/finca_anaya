import { Router } from "express";
import {
  getProcesses,
  getProcess,
  putProcessAdminData,
  postProcess,
  putStartProcess,
  putProcessPendingLaboratory,
  putProcessPhysicalReview,
  putFinishProcess,
} from "../controllers/processes.controller.js";
import { requireAuth, requireRoles } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/", requireAuth, getProcesses);
router.get("/:id", requireAuth, getProcess);
router.post("/", requireAuth, requireRoles("admin", "accounting", "warehouse", "laboratory"), postProcess);
router.put("/:id/admin-data", requireAuth, requireRoles("admin", "accounting", "warehouse"), putProcessAdminData);
router.put("/:id/start", requireAuth, requireRoles("admin", "accounting", "warehouse", "laboratory"), putStartProcess);
router.put("/:id/pending-laboratory", requireAuth, requireRoles("admin", "accounting", "warehouse", "laboratory"), putProcessPendingLaboratory);
router.put("/:id/physical-review", requireAuth, requireRoles("admin", "accounting", "warehouse", "laboratory"), putProcessPhysicalReview);
router.put("/:id/finish", requireAuth, requireRoles("admin", "accounting", "laboratory"), putFinishProcess);

export default router;
