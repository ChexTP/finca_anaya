import { Router } from "express";
import {
  getSample,
  getSamples,
  postSample,
  putSampleStatus,
} from "../controllers/samples.controller.js";
import { requireAuth, requireRoles } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/", requireAuth, requireRoles("admin", "accounting", "seller", "samples"), getSamples);
router.get("/:id", requireAuth, requireRoles("admin", "accounting", "seller", "samples"), getSample);
router.post("/", requireAuth, requireRoles("admin", "accounting", "seller"), postSample);
router.put("/:id/status", requireAuth, requireRoles("admin", "accounting", "samples"), putSampleStatus);

export default router;
