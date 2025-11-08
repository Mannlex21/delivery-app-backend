// src/routes/auth.routes.ts
import { Router } from "express";
import * as authController from "../controllers/auth.controller.js";
import { isAuthenticated } from "../middleware/auth.middleware.js";
const router = Router();

router.post("/register", authController.register);
router.post("/login", authController.login);
router.post("/refresh-token", authController.refreshToken);
router.post("/logout", authController.logout);
router.get("/me", isAuthenticated, authController.getMe);
export default router;
