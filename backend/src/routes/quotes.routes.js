import { Router } from "express";
import {
  getQuotes,
  getQuote,
  postQuote,
  putQuote,
  putQuoteStatus,
  deleteQuote,
} from "../controllers/quotes.controller.js";
import { requireAuth, requireRoles } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/", requireAuth, getQuotes);
router.get("/:id", requireAuth, getQuote);
router.post("/", requireAuth, requireRoles("admin", "accounting", "seller", "inventory_viewer"), postQuote);
router.put("/:id", requireAuth, requireRoles("admin", "accounting", "seller", "inventory_viewer"), putQuote);
router.put("/:id/status", requireAuth, requireRoles("admin", "accounting", "seller", "inventory_viewer"), putQuoteStatus);
router.delete("/:id", requireAuth, requireRoles("admin"), deleteQuote);

export default router;
