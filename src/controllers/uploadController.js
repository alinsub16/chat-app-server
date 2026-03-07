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
      try {
        // Upload to Cloudinary with resource_type auto
        const result = await cloudinary.uploader.upload(file.path, {
          folder: "chat-attachments",
          resource_type: "auto",
          access_mode: "public", // public so front-end can load files
        });

        // Delete local temp file
        await fs.unlink(file.path);

        // Map Cloudinary resource_type and format to friendly fileType
        let fileType;
        if (result.resource_type === "image") {
          fileType = "image";
        } else if (result.resource_type === "video") {
          fileType = "video";
        } else {
          // raw files (pdf, txt, doc, etc.)
          if (result.format === "pdf") fileType = "pdf";
          else if (result.format === "txt") fileType = "txt";
          else fileType = "file"; // fallback
        }

        return {
          url: result.secure_url,
          fileName: file.originalname,
          fileType,
          public_id: result.public_id,
        };
      } catch (err) {
        console.error(`Failed to upload file ${file.originalname}:`, err);
        return null;
      }
    });

    // Remove any failed uploads
    const attachments = (await Promise.all(uploadPromises)).filter(Boolean);

    if (attachments.length === 0) {
      return res.status(500).json({ message: "All uploads failed" });
    }

    res.status(201).json({
      message: "Files uploaded successfully",
      attachments,
    });
  } catch (error) {
    console.error("Attachment upload error:", error);
    res.status(500).json({ message: "Failed to upload attachments" });
  }
};