import { Router } from "express";
import {
  getProcesses,
  getProcess,
  postProcess,
  putStartProcess,
  putProcessPendingLaboratory,
  putFinishProcess,
} from "../controllers/processes.controller.js";
import { requireAuth, requireRoles } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/", requireAuth, getProcesses);
router.get("/:id", requireAuth, getProcess);
router.post("/", requireAuth, requireRoles("admin", "warehouse"), postProcess);
router.put("/:id/start", requireAuth, requireRoles("admin"), putStartProcess);
router.put("/:id/pending-laboratory", requireAuth, requireRoles("admin"), putProcessPendingLaboratory);
router.put("/:id/finish", requireAuth, requireRoles("admin", "laboratory"), putFinishProcess);

export default router;
