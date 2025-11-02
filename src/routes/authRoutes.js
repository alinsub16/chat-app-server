import express from "express";
import { registerUser, loginUser, updateOwnProfile, deleteOwnProfile } from "../controllers/authController.js";
import protect from "../middleware/authMiddleware.js";
import { uploadImage } from "../middleware/uploadMiddleware.js";

const router = express.Router();

// Public routes
router.post("/register", uploadImage.single("profilePicture"), registerUser);
router.post("/login", loginUser);

// GET /api/auth/profile — protected
// Show profile
router.get("/profile", protect, (req, res) => {
  res.json({ message: "User profile data", user: req.user });
});

// PUT /api/users/me
// Update profile
router.put("/me", protect, uploadImage.single("profilePicture"), updateOwnProfile);

// DELETE own account
router.delete("/me", protect, deleteOwnProfile);

export default router;
