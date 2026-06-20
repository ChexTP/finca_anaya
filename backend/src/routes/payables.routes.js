import { Router } from "express";
import {
  getPayables,
  getPayable,
  postPayable,
  postPayablePayment,
} from "../controllers/payables.controller.js";
import { requireAuth, requireRoles } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/", requireAuth, requireRoles("admin", "accounting"), getPayables);
router.get("/:id", requireAuth, requireRoles("admin", "accounting"), getPayable);
router.post("/", requireAuth, requireRoles("admin", "accounting"), postPayable);
router.post("/:id/payments", requireAuth, requireRoles("admin", "accounting"), postPayablePayment);

export default router;
