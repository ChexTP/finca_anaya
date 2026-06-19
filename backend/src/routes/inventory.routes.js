import { Router } from "express";
import {
  getInventoryLots,
  getInventoryGrouped,
  getInventoryMovements,
  postInventoryAdjustment,
} from "../controllers/inventory.controller.js";
import { requireAuth, requireRoles } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/lots", requireAuth, getInventoryLots);
router.get("/grouped", requireAuth, getInventoryGrouped);
router.get("/lots/:lotId/movements", requireAuth, getInventoryMovements);
router.post(
  "/lots/:lotId/adjustments",
  requireAuth,
  requireRoles("admin", "accounting"),
  postInventoryAdjustment
);

export default router;
