import express from "express";

import { protectRoute } from "../middleware/auth.middleware.js";
import { getUserById, updateProfile, searchUsers, batchGetUsers } from "../controllers/user.controller.js";

const router = express.Router();

router.get("/search", protectRoute, searchUsers);
router.get("/:id", protectRoute, getUserById);
router.put("/:id", protectRoute, updateProfile);
router.post("/batch", batchGetUsers);

export default router;