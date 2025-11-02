import User from "../models/User.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import generateToken from "../utils/generateToken.js";
import cloudinary from "../config/cloudinary.js";
import { registerSchema, updateProfileSchema } from "../validation/authValidation.js";


// REGISTER
export const registerUser = async (req, res) => {
  try {
    // =========================
    // 1. VALIDATE INPUT
    // =========================
    const { error } = registerSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({
        message: "Validation failed",
        errors: error.details.map((err) => err.message),
      });
    }

    const { firstName, lastName, middleName, email, phoneNumber, password } = req.body;



   // =========================
    // 2. CHECK FOR DUPLICATES
    // =========================
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

    // =========================
    // 3. HANDLE PROFILE IMAGE
    // =======================
    let profilePictureUrl = null;

    // If user uploaded a file, send to Cloudinary
    if (req.file) {
      try {
        const uploadResult = await cloudinary.uploader.upload(req.file.path, {
          folder: "user_profiles",
          resource_type: "auto",
        });
        profilePictureUrl = uploadResult.secure_url;
      } catch (uploadError) {
        console.error(" Cloudinary upload error:", uploadError);
        return res.status(500).json({ message: "Failed to upload profile picture" });
      }
    }
    //  Just pass the plain password, let mongoose middleware hash it
    const newUser = await User.create({
      firstName,
      lastName,
      middleName,
      email,
      phoneNumber: phoneNumber,
      password,
      profilePicture: profilePictureUrl,
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

// LOGIN
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    // Create JWT
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
//  Update own profile 
export const updateOwnProfile = async (req, res) => {
  try {
    const userId = req.user._id; 
    const { error } = updateProfileSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({
        message: "Validation failed",
        errors: error.details.map((err) => err.message),
      });
    }
    const { firstName, lastName, middleName, phoneNumber, password, currentPassword, email } = req.body;

    // Find the logged-in user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    let shouldLogout = false;

    // Update basic fields
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (middleName) user.middleName = middleName;
    if (phoneNumber) user.phoneNumber = phoneNumber;

    // =========================
    // EMAIL CHANGE LOGIC
    // =========================
    if (email && email !== user.email) {
      // Require current password to change email
      if (!currentPassword) {
        return res.status(400).json({ message: "Current password is required to change email" });
      }

      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return res.status(400).json({ message: "Current password is incorrect" });
      }

      // Check if new email already exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ message: "Email is already taken" });
      }

      user.email = email; // safe to update
      shouldLogout = true;
      user.tokenVersion += 1;
    }

    // =========================
    // PASSWORD CHANGE LOGIC
    // =========================
    if (password) {
      if (!currentPassword) {
        return res.status(400).json({ message: "Current password is required to set a new password" });
      }

      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return res.status(400).json({ message: "Current password is incorrect" });
      }
      
    user.password = password;
    shouldLogout = true;
    user.tokenVersion += 1;
    }
    // =========================
    // PROFILE PICTURE UPDATE
    // =========================
    if (req.file) {
      // Upload new image to Cloudinary
      const uploadResult = await cloudinary.uploader.upload(req.file.path, {
        folder: "user_profiles",
        resource_type: "image",
      });

      // Delete old image from Cloudinary if exists
      if (user.profilePicture) {
        const oldImagePublicId = user.profilePicture.split("/").slice(-1)[0].split(".")[0];
        await cloudinary.uploader.destroy(`user_profiles/${oldImagePublicId}`);
      }

      // Save new Cloudinary URL
      user.profilePicture = uploadResult.secure_url;
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
export const deleteOwnProfile = async (req, res) => {
  try {
    const userId = req.user._id; // From JWT

    // Find the user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // =========================
    // CLOUDINARY IMAGE CLEANUP
    // =========================
    if (user.profilePicture) {
      try {
        // Extract public_id from Cloudinary URL
        const parts = user.profilePicture.split("/");
        const filename = parts[parts.length - 1]; // e.g., abc123.jpg
        const publicId = `user_profiles/${filename.split(".")[0]}`; 

        await cloudinary.uploader.destroy(publicId);
        console.log("Cloudinary profile image deleted:", publicId);
      } catch (cloudError) {
        console.error("Cloudinary deletion error:", cloudError.message);
        // Continue even if Cloudinary deletion fails
      }
    }

    // =========================
    // DELETE USER FROM DATABASE
    // =========================
    await user.deleteOne();

    res.json({
      message: "Account deleted successfully",
      deletedUserId: userId
    });
  } catch (error) {
    console.error(" Error deleting profile:", error);
    res.status(500).json({ message: "Failed to delete account" });
  }
};
