import { Router } from "express";
import {
  getUsers,
  createSeller,
  updateUserPassword,
  updateUserStatus,
} from "../controllers/users.controller.js";
import { requireAuth, requireRoles } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/", requireAuth, requireRoles("admin"), getUsers);
router.post("/sellers", requireAuth, requireRoles("admin"), createSeller);
router.put("/:id/password", requireAuth, requireRoles("admin"), updateUserPassword);
router.put("/:id/status", requireAuth, requireRoles("admin"), updateUserStatus);

export default router;
