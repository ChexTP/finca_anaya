import { Router } from "express";
import {
  getLots,
  getLot,
  postReceivedLot,
  postInitialLoad,
  putLabReview,
  putPhysicalReview,
  putPurchase,
  putRejectedLotWithdrawal,
} from "../controllers/lots.controller.js";
import { requireAuth, requireRoles } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/", requireAuth, getLots);
router.get("/:id", requireAuth, getLot);
router.post("/received", requireAuth, requireRoles("admin", "warehouse"), postReceivedLot);
router.post("/initial-load", requireAuth, requireRoles("admin"), postInitialLoad);
router.put("/:id/lab-review", requireAuth, requireRoles("admin", "laboratory"), putLabReview);
router.put("/:id/physical-review", requireAuth, requireRoles("admin", "warehouse"), putPhysicalReview);
router.put("/:id/purchase", requireAuth, requireRoles("admin", "accounting"), putPurchase);
router.put("/:id/withdraw-rejected", requireAuth, requireRoles("admin", "warehouse"), putRejectedLotWithdrawal);

export default router;
