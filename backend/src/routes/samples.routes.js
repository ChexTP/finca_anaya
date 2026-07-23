import { Router } from "express";
import {
  getSample,
  getSamples,
  postSample,
  putSampleStatus,
  putSampleBlend,
} from "../controllers/samples.controller.js";
import { requireAuth, requireRoles } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/", requireAuth, requireRoles("admin", "accounting", "seller", "samples"), getSamples);
router.get("/:id", requireAuth, requireRoles("admin", "accounting", "seller", "samples"), getSample);
router.post("/", requireAuth, requireRoles("admin", "seller"), postSample);
router.put("/:id/status", requireAuth, requireRoles("admin", "samples"), putSampleStatus);
router.put("/:id/blend", requireAuth, requireRoles("admin", "samples"), putSampleBlend);

export default router;
