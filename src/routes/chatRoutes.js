// src/routes/chatRoutes.js
import express from "express";
import { createChat, getUserChats, addMemberToGroup, deleteGroupChat } from "../controllers/chatController.js";
import protect from "../middleware/authMiddleware.js";

const router = express.Router();

// Create a new chat (group or private)
router.post("/", protect, createChat);

// Get all chats for the logged-in user
router.get("/", protect, getUserChats);

// Add a new member to an existing group chat
router.put("/:chatId/add-member", protect, addMemberToGroup);

router.delete("/:chatId", protect, deleteGroupChat);

export default router;
