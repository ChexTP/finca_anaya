import { Router } from "express";
import {
  getInventoryLots,
  getInventoryGrouped,
  getInventoryMovements,
  getInventoryInProcess,
  getSampleInventoryOutputs,
  postInventoryAdjustment,
  postSampleInventoryOutput,
} from "../controllers/inventory.controller.js";
import { requireAuth, requireRoles } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/lots", requireAuth, getInventoryLots);
router.get("/grouped", requireAuth, getInventoryGrouped);
router.get("/in-process", requireAuth, getInventoryInProcess);
router.get("/sample-outputs", requireAuth, requireRoles("admin", "accounting", "warehouse"), getSampleInventoryOutputs);
router.get("/lots/:lotId/movements", requireAuth, getInventoryMovements);
router.post(
  "/lots/:lotId/adjustments",
  requireAuth,
  requireRoles("admin", "accounting", "warehouse"),
  postInventoryAdjustment
);
router.post(
  "/lots/:lotId/sample-output",
  requireAuth,
  requireRoles("admin", "accounting", "warehouse"),
  postSampleInventoryOutput
);

export default router;
