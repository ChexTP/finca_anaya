import { Router } from "express";
import {
  getSalesSummary,
  getSalesBySeller,
  getSalesByProfile,
  getProfit,
  getAccountsReceivable,
  getAccountsPayable,
  getInventory,
} from "../controllers/reports.controller.js";
import { requireAuth, requireRoles } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/sales-summary", requireAuth, requireRoles("admin", "accounting"), getSalesSummary);
router.get("/sales-by-seller", requireAuth, requireRoles("admin", "accounting"), getSalesBySeller);
router.get("/sales-by-profile", requireAuth, requireRoles("admin", "accounting"), getSalesByProfile);
router.get("/profit", requireAuth, requireRoles("admin", "accounting"), getProfit);
router.get("/accounts-receivable", requireAuth, requireRoles("admin", "accounting"), getAccountsReceivable);
router.get("/accounts-payable", requireAuth, requireRoles("admin", "accounting"), getAccountsPayable);
router.get("/inventory", requireAuth, requireRoles("admin", "accounting"), getInventory);

export default router;
