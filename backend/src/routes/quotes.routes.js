import { Router } from "express";
import {
  getQuotes,
  getQuote,
  postQuote,
  putQuoteStatus,
} from "../controllers/quotes.controller.js";
import { requireAuth, requireRoles } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/", requireAuth, getQuotes);
router.get("/:id", requireAuth, getQuote);
router.post("/", requireAuth, requireRoles("admin", "accounting", "seller"), postQuote);
router.put("/:id/status", requireAuth, requireRoles("admin", "accounting", "seller"), putQuoteStatus);

export default router;
