import express from "express";
import {  sendMessage, getMessages, deleteMessage, updateMessage  } from "../controllers/messageController.js";
import protect from "../middleware/authMiddleware.js";
import { uploadGeneral } from "../middleware/uploadMiddleware.js";


const router = express.Router();

// Endpoint to send message with optional attachments
router.post("/", protect, uploadGeneral.array("attachments", 5), sendMessage);

// Get messages for a chat
router.get("/:chatId", protect, getMessages);

// 🗑 Delete a specific message
router.delete("/:messageId", protect, deleteMessage);

// Update message content only
router.put("/:messageId", protect, updateMessage);

export default router;
