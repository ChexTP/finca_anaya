import { Router } from "express";
import {
  getBackupModules,
  getBackupHistory,
  exportBackup,
} from "../controllers/backups.controller.js";
import { requireAuth, requireRoles } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/modules", requireAuth, requireRoles("admin", "accounting"), getBackupModules);
router.get("/history", requireAuth, requireRoles("admin", "accounting"), getBackupHistory);
router.get("/export", requireAuth, requireRoles("admin", "accounting"), exportBackup);

export default router;
