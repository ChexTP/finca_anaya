import { Router } from "express";
import {
  getLots,
  getLot,
  postReceivedLot,
  postInitialLoad,
  postStockEntry,
  putLotCode,
  putLotAdminData,
  putReceptionData,
  putLabReview,
  putLabData,
  putPhysicalReview,
  putPurchase,
  putLiquidation,
  putRejectedLotWithdrawal,
} from "../controllers/lots.controller.js";
import { requireAuth, requireRoles } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/", requireAuth, getLots);
router.get("/:id", requireAuth, getLot);
router.post("/received", requireAuth, requireRoles("admin", "warehouse"), postReceivedLot);
router.post("/stock-entry", requireAuth, requireRoles("admin", "warehouse"), postStockEntry);
router.post("/initial-load", requireAuth, requireRoles("admin"), postInitialLoad);
router.put("/:id/code", requireAuth, requireRoles("admin", "warehouse"), putLotCode);
router.put("/:id/admin-data", requireAuth, requireRoles("admin"), putLotAdminData);
router.put("/:id/reception", requireAuth, requireRoles("admin", "warehouse"), putReceptionData);
router.put("/:id/lab-review", requireAuth, requireRoles("admin", "laboratory"), putLabReview);
router.put("/:id/lab-data", requireAuth, requireRoles("admin", "laboratory"), putLabData);
router.put("/:id/physical-review", requireAuth, requireRoles("admin", "warehouse"), putPhysicalReview);
router.put("/:id/liquidate", requireAuth, requireRoles("admin", "accounting"), putLiquidation);
router.put("/:id/purchase", requireAuth, requireRoles("admin", "accounting"), putPurchase);
router.put("/:id/withdraw-rejected", requireAuth, requireRoles("admin", "warehouse"), putRejectedLotWithdrawal);

export default router;
