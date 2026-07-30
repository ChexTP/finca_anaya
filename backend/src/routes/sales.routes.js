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
  putSaleReadyForBlend,
  putSaleBlendOrder,
  putSaleWithoutBlend,
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
  requireRoles("admin", "warehouse", "laboratory"),
  deleteSaleLotAssignment
);
router.get("/:id", requireAuth, requireRoles("admin", "accounting", "warehouse", "seller", "laboratory"), getSale);
router.put("/:id/code", requireAuth, requireRoles("admin"), putSaleCode);
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
  requireRoles("admin", "laboratory"),
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
  requireRoles("admin", "warehouse"),
  putSaleReadyForBlend
);
router.put(
  "/:id/blend-order",
  requireAuth,
  requireRoles("admin", "laboratory"),
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
  requireRoles("admin", "warehouse", "accounting", "laboratory"),
  putSaleOrderAssignee
);
router.put(
  "/:id/items/:itemId/shortage",
  requireAuth,
  requireRoles("admin", "warehouse", "accounting", "laboratory"),
  putSaleItemShortage
);
router.put(
  "/:id/lot-assignments",
  requireAuth,
  requireRoles("admin", "warehouse", "laboratory"),
  putSaleLotAssignments
);
router.post(
  "/:id/payments",
  requireAuth,
  requireRoles("admin", "accounting"),
  postSalePayment
);

export default router;
