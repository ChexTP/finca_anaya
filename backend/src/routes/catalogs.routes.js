import { Router } from "express";
import {
  deleteCoffeeProfileById,
  deletePurchaseCoffeeById,
  getCatalogs,
  getCoffeeProfilesAdmin,
  getEditableCatalogItems,
  getPurchaseCoffeesAdmin,
  postEditableCatalogItem,
  postCoffeeProfile,
  postPurchaseCoffee,
  putEditableCatalogItem,
  putCoffeeProfile,
  putPurchaseCoffee,
} from "../controllers/catalogs.controller.js";
import { requireAuth, requireRoles } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/", requireAuth, getCatalogs);
router.get("/:catalogKey(coffee-types|coffee-presentations)", requireAuth, requireRoles("admin", "accounting", "warehouse"), getEditableCatalogItems);
router.post("/:catalogKey(coffee-types|coffee-presentations)", requireAuth, requireRoles("admin", "accounting", "warehouse"), postEditableCatalogItem);
router.put("/:catalogKey(coffee-types|coffee-presentations)/:id", requireAuth, requireRoles("admin", "accounting", "warehouse"), putEditableCatalogItem);
router.get("/coffee-profiles", requireAuth, requireRoles("admin", "accounting", "warehouse"), getCoffeeProfilesAdmin);
router.post("/coffee-profiles", requireAuth, requireRoles("admin", "accounting", "warehouse"), postCoffeeProfile);
router.get("/purchase-coffees", requireAuth, requireRoles("admin", "accounting", "warehouse"), getPurchaseCoffeesAdmin);
router.post("/purchase-coffees", requireAuth, requireRoles("admin", "accounting", "warehouse"), postPurchaseCoffee);
router.put("/purchase-coffees/:id", requireAuth, requireRoles("admin", "accounting", "warehouse"), putPurchaseCoffee);
router.delete("/purchase-coffees/:id", requireAuth, requireRoles("admin"), deletePurchaseCoffeeById);
router.put(
  "/coffee-profiles/:id",
  requireAuth,
  requireRoles("admin", "accounting", "warehouse"),
  putCoffeeProfile
);
router.delete("/coffee-profiles/:id", requireAuth, requireRoles("admin"), deleteCoffeeProfileById);

export default router;
