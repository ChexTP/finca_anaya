import { Router } from "express";
import { login, getProfile } from "../controllers/auth.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";

const router = Router();

router.post("/login", login);
router.get("/me", requireAuth, getProfile);

export default router;
