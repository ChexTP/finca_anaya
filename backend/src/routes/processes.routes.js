import { Router } from "express";
import {
  getProcesses,
  getProcess,
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
router.post("/", requireAuth, requireRoles("admin", "warehouse"), postProcess);
router.put("/:id/start", requireAuth, requireRoles("admin", "warehouse"), putStartProcess);
router.put("/:id/pending-laboratory", requireAuth, requireRoles("admin", "warehouse"), putProcessPendingLaboratory);
router.put("/:id/physical-review", requireAuth, requireRoles("admin", "warehouse"), putProcessPhysicalReview);
router.put("/:id/finish", requireAuth, requireRoles("admin", "laboratory"), putFinishProcess);

export default router;
