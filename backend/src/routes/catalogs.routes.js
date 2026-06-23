import { Router } from "express";
import {
  getCatalogs,
  getCoffeeProfilesAdmin,
  postCoffeeProfile,
  putCoffeeProfile,
} from "../controllers/catalogs.controller.js";
import { requireAuth, requireRoles } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/", requireAuth, getCatalogs);
router.get("/coffee-profiles", requireAuth, requireRoles("admin"), getCoffeeProfilesAdmin);
router.post("/coffee-profiles", requireAuth, requireRoles("admin"), postCoffeeProfile);
router.put(
  "/coffee-profiles/:id",
  requireAuth,
  requireRoles("admin", "accounting"),
  putCoffeeProfile
);

export default router;
