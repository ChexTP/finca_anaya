import { Router } from "express";
import {
  getPayables,
  getPayable,
  postPayable,
  postPayablePayment,
  putPurchaseOrderDocument,
} from "../controllers/payables.controller.js";
import { requireAuth, requireRoles } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/", requireAuth, requireRoles("admin", "accounting", "inventory_viewer"), getPayables);
router.get("/:id", requireAuth, requireRoles("admin", "accounting", "inventory_viewer"), getPayable);
router.post("/", requireAuth, requireRoles("admin", "accounting", "inventory_viewer"), postPayable);
router.put("/:id/purchase-order", requireAuth, requireRoles("admin", "accounting", "inventory_viewer"), putPurchaseOrderDocument);
router.post("/:id/payments", requireAuth, requireRoles("admin", "accounting", "inventory_viewer"), postPayablePayment);

export default router;
