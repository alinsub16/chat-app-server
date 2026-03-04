import User from "../models/User.js";
import bcrypt from "bcryptjs";
import generateToken from "../utils/generateToken.js";
import cloudinary from "../config/cloudinary.js";
import fs from "fs/promises";
import { registerSchema, updateProfileSchema } from "../validation/authValidation.js";


// ============================
// REGISTER
// ============================
export const registerUser = async (req, res) => {
  try {
    // 1️⃣ Validate input
    const { error } = registerSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({
        message: "Validation failed",
        errors: error.details.map((err) => err.message),
      });
    }

    let { firstName, lastName, middleName, email, phoneNumber, password } = req.body;

    email = email.toLowerCase();

    // 2️⃣ Check duplicates
    const existingUser = await User.findOne({
      $or: [{ email }, { phoneNumber }],
    });

    if (existingUser) {
      return res.status(400).json({
        message:
          existingUser.email === email
            ? "Email is already registered"
            : "Phone number is already registered",
      });
    }

    // 3️⃣ Handle profile image
    let profilePictureUrl = null;
    let profilePicturePublicId = null;

    if (req.file) {
      try {
        const uploadResult = await cloudinary.uploader.upload(req.file.path, {
          folder: "user_profiles",
          resource_type: "image",
        });

        profilePictureUrl = uploadResult.secure_url;
        profilePicturePublicId = uploadResult.public_id;

        // Delete local temp file
        await fs.unlink(req.file.path);
      } catch (uploadError) {
        console.error("Cloudinary upload error:", uploadError);
        return res.status(500).json({ message: "Failed to upload profile picture" });
      }
    }

    // 4️⃣ Create user
    const newUser = await User.create({
      firstName,
      lastName,
      middleName,
      email,
      phoneNumber,
      password,
      profilePicture: profilePictureUrl,
      profilePicturePublicId,
    });

    res.status(201).json({
      message: "User registered successfully",
      user: {
        _id: newUser._id,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        middleName: newUser.middleName,
        email: newUser.email,
        phoneNumber: newUser.phoneNumber,
        profilePicture: newUser.profilePicture,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// ============================
// LOGIN
// ============================
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email: email.toLowerCase() }).select("+password");
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const token = generateToken(user);

    res.json({
      message: "Login successful",
      token,
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        middleName: user.middleName,
        email: user.email,
        phoneNumber: user.phoneNumber,
        profilePicture: user.profilePicture,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// ============================
// UPDATE OWN PROFILE
// ============================
export const updateOwnProfile = async (req, res) => {
  try {
    const { error } = updateProfileSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({
        message: "Validation failed",
        errors: error.details.map((err) => err.message),
      });
    }

    const user = req.user; // Already attached by protect middleware
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const {
      firstName,
      lastName,
      middleName,
      phoneNumber,
      password,
      currentPassword,
      email,
    } = req.body;

    let shouldLogout = false;

    // Basic updates
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (middleName) user.middleName = middleName;
    if (phoneNumber) user.phoneNumber = phoneNumber;

    // ================= EMAIL CHANGE =================
    if (email && email.toLowerCase() !== user.email) {
      if (!currentPassword) {
        return res.status(400).json({ message: "Current password is required to change email" });
      }

      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return res.status(400).json({ message: "Current password is incorrect" });
      }

      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser) {
        return res.status(400).json({ message: "Email is already taken" });
      }

      user.email = email.toLowerCase();
      user.tokenVersion += 1;
      shouldLogout = true;
    }

    // ================= PASSWORD CHANGE =================
    if (password) {
      if (!currentPassword) {
        return res.status(400).json({ message: "Current password is required to set a new password" });
      }

      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return res.status(400).json({ message: "Current password is incorrect" });
      }

      user.password = password;
      user.tokenVersion += 1;
      shouldLogout = true;
    }

    // ================= PROFILE IMAGE UPDATE =================
    if (req.file) {
      const uploadResult = await cloudinary.uploader.upload(req.file.path, {
        folder: "user_profiles",
        resource_type: "image",
      });

      // Delete old Cloudinary image safely
      if (user.profilePicturePublicId) {
        await cloudinary.uploader.destroy(user.profilePicturePublicId);
      }

      user.profilePicture = uploadResult.secure_url;
      user.profilePicturePublicId = uploadResult.public_id;

      await fs.unlink(req.file.path);
    }

    await user.save();

    res.json({
      message: "Profile updated successfully",
      logout: shouldLogout,
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        middleName: user.middleName,
        email: user.email,
        phoneNumber: user.phoneNumber,
        profilePicture: user.profilePicture,
      },
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({ message: "Failed to update profile" });
  }
};


// ============================
// DELETE OWN PROFILE
// ============================
export const deleteOwnProfile = async (req, res) => {
  try {
    const user = req.user;

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Delete Cloudinary image safely
    if (user.profilePicturePublicId) {
      try {
        await cloudinary.uploader.destroy(user.profilePicturePublicId);
      } catch (cloudError) {
        console.error("Cloudinary deletion error:", cloudError.message);
      }
    }

    await user.deleteOne();

    res.json({
      message: "Account deleted successfully",
      deletedUserId: user._id,
    });
  } catch (error) {
    console.error("Error deleting profile:", error);
    res.status(500).json({ message: "Failed to delete account" });
  }
};