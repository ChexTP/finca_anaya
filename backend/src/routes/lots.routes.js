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
  postGroupedLiquidation,
  putRejectedLotWithdrawal,
} from "../controllers/lots.controller.js";
import { requireAuth, requireRoles } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/", requireAuth, getLots);
router.get("/:id", requireAuth, getLot);
router.post("/received", requireAuth, requireRoles("admin", "accounting", "warehouse"), postReceivedLot);
router.post("/stock-entry", requireAuth, requireRoles("admin", "accounting", "warehouse"), postStockEntry);
router.post("/initial-load", requireAuth, requireRoles("admin", "accounting"), postInitialLoad);
router.put("/:id/code", requireAuth, requireRoles("admin", "accounting", "warehouse"), putLotCode);
router.put("/:id/admin-data", requireAuth, requireRoles("admin", "accounting", "warehouse"), putLotAdminData);
router.put("/:id/reception", requireAuth, requireRoles("admin", "accounting", "warehouse"), putReceptionData);
router.put("/:id/lab-review", requireAuth, requireRoles("admin", "accounting", "laboratory"), putLabReview);
router.put("/:id/lab-data", requireAuth, requireRoles("admin", "accounting", "laboratory"), putLabData);
router.put("/:id/physical-review", requireAuth, requireRoles("admin", "accounting", "warehouse"), putPhysicalReview);
router.post("/liquidate-group", requireAuth, requireRoles("admin", "accounting"), postGroupedLiquidation);
router.put("/:id/liquidate", requireAuth, requireRoles("admin", "accounting"), putLiquidation);
router.put("/:id/purchase", requireAuth, requireRoles("admin", "accounting"), putPurchase);
router.put("/:id/withdraw-rejected", requireAuth, requireRoles("admin", "accounting", "warehouse"), putRejectedLotWithdrawal);

export default router;
