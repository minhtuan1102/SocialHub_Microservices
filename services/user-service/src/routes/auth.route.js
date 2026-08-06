import express from "express";

import { register, login, logout, refresh, changePassword, forgotPassword, resetPassword, googleLogin } from "../controllers/auth.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/logout", protectRoute, logout);
router.post("/refresh", refresh);
router.post("/change-password", protectRoute, changePassword);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.post("/google", googleLogin);

export default router;