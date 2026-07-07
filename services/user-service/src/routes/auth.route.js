import express from "express";

import { register, login, logout, refresh } from "../controllers/auth.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/logout", protectRoute, logout);
router.post("/refresh", refresh);

export default router;