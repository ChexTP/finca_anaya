import { Router } from "express";
import {
  getCodeCounters,
  putCodeCounter,
} from "../controllers/codeCounters.controller.js";
import { requireAuth, requireRoles } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/", requireAuth, requireRoles("admin", "accounting", "warehouse", "seller"), getCodeCounters);
router.put("/:prefix", requireAuth, requireRoles("admin", "accounting", "warehouse"), putCodeCounter);

export default router;
