import { Router } from "express";
import {
  getClients,
  getClient,
  postClient,
  putClient,
} from "../controllers/clients.controller.js";
import { requireAuth, requireRoles } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/", requireAuth, getClients);
router.get("/:id", requireAuth, getClient);
router.post("/", requireAuth, requireRoles("admin", "accounting", "seller", "inventory_viewer"), postClient);
router.put("/:id", requireAuth, requireRoles("admin", "accounting", "seller", "inventory_viewer"), putClient);

export default router;
