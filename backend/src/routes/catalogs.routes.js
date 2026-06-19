import { Router } from "express";
import { getCatalogs } from "../controllers/catalogs.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/", requireAuth, getCatalogs);

export default router;

