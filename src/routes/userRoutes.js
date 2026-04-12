import express from "express";
import { getUserProfile } from "../controllers/userController.js";
import protect from "../middleware/authMiddleware.js";

const router = express.Router();

// ============================
// View user profile
// ============================
router.get("/:id", protect, getUserProfile);

export default router;