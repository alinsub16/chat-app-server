import express from "express";
import { createOrGetConversation, getUserConversations, deleteConversation } from "../controllers/conversationController.js";
import protect from "../middleware/authMiddleware.js";

const router = express.Router();
// create or return existing
router.post("/", protect, createOrGetConversation);  
// all conversations for user   
router.get("/", protect, getUserConversations);          
// Delete a specific conversation
router.delete("/:conversationId", protect, deleteConversation);
export default router;