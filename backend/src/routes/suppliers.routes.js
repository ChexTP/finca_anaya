import { Router } from "express";
import {
  getSuppliers,
  getSupplier,
  postSupplier,
  putSupplier,
} from "../controllers/suppliers.controller.js";
import { requireAuth, requireRoles } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/", requireAuth, getSuppliers);
router.get("/:id", requireAuth, getSupplier);
router.post("/", requireAuth, requireRoles("admin", "warehouse"), postSupplier);
router.put("/:id", requireAuth, requireRoles("admin", "warehouse"), putSupplier);

export default router;

