import { Router } from "express";
import {
  getSales,
  getSale,
  putSaleCode,
  postSaleFromQuote,
  postDirectSale,
  putSalePrepared,
  putSaleDispatched,
  postSalePayment,
  putSaleCancelled,
  deleteSale,
  putSaleReadyForBlend,
  putSaleBlendOrder,
  putSaleWithoutBlend,
  putSaleReturnToWarehouse,
  putSalePriority,
  putSaleOrderAssignee,
  putSaleItemShortage,
  putSaleLotAssignments,
  deleteSaleLotAssignment,
  getSaleLotReservations,
  putSalePendingLaboratory,
  putSaleLabReview,
} from "../controllers/sales.controller.js";
import { requireAuth, requireRoles } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/", requireAuth, requireRoles("admin", "accounting", "warehouse", "seller", "laboratory"), getSales);
router.get(
  "/lot-reservations",
  requireAuth,
  requireRoles("admin", "accounting", "warehouse"),
  getSaleLotReservations
);
router.delete(
  "/lot-assignments/:assignmentId",
  requireAuth,
  requireRoles("admin", "accounting", "warehouse"),
  deleteSaleLotAssignment
);
router.get("/:id", requireAuth, requireRoles("admin", "accounting", "warehouse", "seller", "laboratory"), getSale);
router.delete("/:id", requireAuth, requireRoles("admin"), deleteSale);
router.put("/:id/code", requireAuth, requireRoles("admin", "accounting"), putSaleCode);
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
  "/:id/send-lab",
  requireAuth,
  requireRoles("admin", "warehouse", "accounting"),
  putSalePendingLaboratory
);
router.put(
  "/:id/lab-review",
  requireAuth,
  requireRoles("admin", "accounting", "laboratory"),
  putSaleLabReview
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
  "/:id/request-blend",
  requireAuth,
  requireRoles("admin", "accounting", "warehouse", "laboratory"),
  putSaleReadyForBlend
);
router.put(
  "/:id/blend-order",
  requireAuth,
  requireRoles("admin", "accounting", "laboratory"),
  putSaleBlendOrder
);
router.put(
  "/:id/without-blend",
  requireAuth,
  requireRoles("admin", "accounting", "laboratory"),
  putSaleWithoutBlend
);
router.put(
  "/:id/return-to-warehouse",
  requireAuth,
  requireRoles("admin", "accounting", "warehouse", "laboratory"),
  putSaleReturnToWarehouse
);
router.put(
  "/:id/priority",
  requireAuth,
  requireRoles("admin", "accounting", "warehouse", "laboratory"),
  putSalePriority
);
router.put(
  "/:id/order-assignee",
  requireAuth,
  requireRoles("admin", "warehouse", "accounting", "laboratory"),
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
  requireRoles("admin", "accounting", "warehouse"),
  putSaleLotAssignments
);
router.post(
  "/:id/payments",
  requireAuth,
  requireRoles("admin", "accounting"),
  postSalePayment
);

export default router;
