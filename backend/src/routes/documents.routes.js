import { Router } from "express";
import {
  getQuoteDocument,
  getSaleDocument,
} from "../controllers/documents.controller.js";
import { requireAuth, requireRoles } from "../middlewares/auth.middleware.js";

const router = Router();

router.get(
  "/quotes/:id",
  requireAuth,
  requireRoles("admin", "accounting", "seller"),
  getQuoteDocument
);
router.get(
  "/sales/:id",
  requireAuth,
  requireRoles("admin", "accounting", "warehouse"),
  getSaleDocument
);

export default router;
