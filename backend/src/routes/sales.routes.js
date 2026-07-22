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
  putSaleBlendOrder,
  putSaleWithoutBlend,
  putSalePriority,
  putSaleOrderAssignee,
  putSaleItemShortage,
  putSaleLotAssignments,
} from "../controllers/sales.controller.js";
import { requireAuth, requireRoles } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/", requireAuth, requireRoles("admin", "accounting", "warehouse", "seller", "laboratory"), getSales);
router.get("/:id", requireAuth, requireRoles("admin", "accounting", "warehouse", "seller", "laboratory"), getSale);
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
router.put(
  "/:id/blend-order",
  requireAuth,
  requireRoles("admin", "laboratory", "warehouse", "accounting"),
  putSaleBlendOrder
);
router.put(
  "/:id/without-blend",
  requireAuth,
  requireRoles("admin", "laboratory"),
  putSaleWithoutBlend
);
router.put(
  "/:id/priority",
  requireAuth,
  requireRoles("admin", "warehouse"),
  putSalePriority
);
router.put(
  "/:id/order-assignee",
  requireAuth,
  requireRoles("admin", "warehouse", "accounting"),
  putSaleOrderAssignee
);
router.put(
  "/:id/items/:itemId/shortage",
  requireAuth,
  requireRoles("admin", "warehouse", "accounting"),
  putSaleItemShortage
);
router.put(
  "/:id/lot-assignments",
  requireAuth,
  requireRoles("admin", "warehouse"),
  putSaleLotAssignments
);
router.post(
  "/:id/payments",
  requireAuth,
  requireRoles("admin", "accounting"),
  postSalePayment
);

export default router;
