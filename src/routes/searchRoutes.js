import express from "express";
import { searchUsers } from "../controllers/searchController.js";
import protect from "../middleware/authMiddleware.js";

const router = express.Router();

// GET /api/users/search?query=keyword
router.get("/users", protect, searchUsers);

export default router;