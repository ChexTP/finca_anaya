import { Router } from "express";
import { getCatalogs, putCoffeeProfile } from "../controllers/catalogs.controller.js";
import { requireAuth, requireRoles } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/", requireAuth, getCatalogs);
router.put(
  "/coffee-profiles/:id",
  requireAuth,
  requireRoles("admin", "accounting"),
  putCoffeeProfile
);

export default router;
