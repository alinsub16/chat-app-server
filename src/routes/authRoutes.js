import express from "express";
import {
  registerUser,
  loginUser,
  updateBasicProfile,
  deleteOwnProfile,
  changePassword,
  changeEmail,
} from "../controllers/authController.js";
import protect from "../middleware/authMiddleware.js";
import { uploadImage } from "../middleware/uploadMiddleware.js";

const router = express.Router();

// Public routes
router.post("/register", uploadImage.single("profilePicture"), registerUser);
router.post("/login", loginUser);


// Show profile
router.get("/profile", protect, (req, res) => {
  res.json({ message: "User profile data", user: req.user });
});


// Update profile
router.put("/me", protect, uploadImage.single("profilePicture"), updateBasicProfile);

// Sensitive actions
router.put("/me/change-password", protect, changePassword);
router.put("/me/change-email", protect, changeEmail);

// DELETE own account
router.delete("/me", protect, deleteOwnProfile);

export default router;
