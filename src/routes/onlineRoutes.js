
import express from "express";
import { getOnlineUsers, checkUserOnline } from "../controllers/onlineStatusController.js";
import protect from "../middleware/authMiddleware.js";

const router = express.Router();

// Require authentication to access these routes
router.get("/", protect, getOnlineUsers);          // GET /api/online-users
router.get("/:userId", protect, checkUserOnline); // GET /api/online-users/:userId

export default router;