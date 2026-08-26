import { Router } from "express";
import {
  getSample,
  getSamples,
  putSample,
  postSample,
  putSampleBlend,
  putSampleShippingGuide,
  putSampleStatus,
  deleteSample,
} from "../controllers/samples.controller.js";
import { requireAuth, requireRoles } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/", requireAuth, requireRoles("admin", "accounting", "seller", "samples", "laboratory", "inventory_viewer"), getSamples);
router.get("/:id", requireAuth, requireRoles("admin", "accounting", "seller", "samples", "laboratory", "inventory_viewer"), getSample);
router.post("/", requireAuth, requireRoles("admin", "accounting", "seller", "inventory_viewer"), postSample);
router.put("/:id", requireAuth, requireRoles("admin", "accounting", "seller", "inventory_viewer"), putSample);
router.delete("/:id", requireAuth, requireRoles("admin"), deleteSample);
router.put("/:id/status", requireAuth, requireRoles("admin", "accounting", "samples", "laboratory"), putSampleStatus);
router.put("/:id/blend", requireAuth, requireRoles("admin", "samples", "laboratory"), putSampleBlend);
router.put("/:id/shipping-guide", requireAuth, requireRoles("admin", "samples"), putSampleShippingGuide);

export default router;
