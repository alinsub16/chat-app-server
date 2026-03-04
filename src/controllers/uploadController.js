import cloudinary from "../config/cloudinary.js";
import fs from "fs/promises";

// -----------------------------
// Chat attachments upload (for messages)
// -----------------------------
export const uploadChatAttachments = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "No files uploaded" });
    }

    const uploadPromises = req.files.map(async (file) => {
      const result = await cloudinary.uploader.upload(file.path, {
        folder: "chat-attachments",
        resource_type: "auto",
      });
      await fs.unlink(file.path);
      return {
        url: result.secure_url,
        fileName: file.originalname,
        fileType: result.resource_type,
      };
    });

    const attachments = await Promise.all(uploadPromises);

    res.status(201).json({
      message: "Files uploaded successfully",
      attachments,
    });
  } catch (error) {
    console.error("Attachment upload error:", error);
    res.status(500).json({ message: "Failed to upload attachments" });
  }
};