import { Router } from "express";
import {
  getCatalogs,
  getCoffeeProfilesAdmin,
  getPurchaseCoffeesAdmin,
  postCoffeeProfile,
  postPurchaseCoffee,
  putCoffeeProfile,
  putPurchaseCoffee,
} from "../controllers/catalogs.controller.js";
import { requireAuth, requireRoles } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/", requireAuth, getCatalogs);
router.get("/coffee-profiles", requireAuth, requireRoles("admin", "accounting", "warehouse"), getCoffeeProfilesAdmin);
router.post("/coffee-profiles", requireAuth, requireRoles("admin", "accounting", "warehouse"), postCoffeeProfile);
router.get("/purchase-coffees", requireAuth, requireRoles("admin", "accounting", "warehouse"), getPurchaseCoffeesAdmin);
router.post("/purchase-coffees", requireAuth, requireRoles("admin", "accounting", "warehouse"), postPurchaseCoffee);
router.put("/purchase-coffees/:id", requireAuth, requireRoles("admin", "accounting", "warehouse"), putPurchaseCoffee);
router.put(
  "/coffee-profiles/:id",
  requireAuth,
  requireRoles("admin", "accounting", "warehouse"),
  putCoffeeProfile
);

export default router;
