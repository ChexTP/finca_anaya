import { Router } from "express";
import {
  getSales,
  getSale,
  postSaleFromQuote,
  postDirectSale,
  putSalePrepared,
  putSaleDispatched,
  postSalePayment,
  putSaleCancelled,
} from "../controllers/sales.controller.js";
import { requireAuth, requireRoles } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/", requireAuth, requireRoles("admin", "accounting", "warehouse", "seller"), getSales);
router.get("/:id", requireAuth, requireRoles("admin", "accounting", "warehouse", "seller"), getSale);
router.post(
  "/from-quote/:quoteId",
  requireAuth,
  requireRoles("admin", "accounting", "warehouse"),
  postSaleFromQuote
);
router.post(
  "/direct",
  requireAuth,
  requireRoles("admin", "accounting"),
  postDirectSale
);
router.put(
  "/:id/prepare",
  requireAuth,
  requireRoles("admin", "accounting", "warehouse"),
  putSalePrepared
);
router.put(
  "/:id/dispatch",
  requireAuth,
  requireRoles("admin", "accounting", "warehouse"),
  putSaleDispatched
);
router.put(
  "/:id/cancel",
  requireAuth,
  requireRoles("admin", "accounting"),
  putSaleCancelled
);
router.post(
  "/:id/payments",
  requireAuth,
  requireRoles("admin", "accounting"),
  postSalePayment
);

export default router;
