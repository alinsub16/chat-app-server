import mongoose from "mongoose";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
/**
 * Create or get a 1-on-1 conversation
 * POST /api/conversations
 * body: { receiverId }
 */
export const createOrGetConversation = async (req, res) => {
  try {
    // Ensure user is authenticated
    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: "Unauthorized: User not found" });
    }

    const senderId = req.user._id;
    const { receiverId } = req.body;

    // Validate receiverId
    if (!receiverId || !mongoose.Types.ObjectId.isValid(receiverId)) {
      return res.status(400).json({ message: "Valid receiverId required" });
    }

    // Find or create conversation atomically
    let conversation = await Conversation.findOne({
      participants: { $all: [senderId, receiverId] },
      $expr: { $eq: [{ $size: "$participants" }, 2] }, // ensures only 2 members
    }).populate("participants", "firstName lastName email");


    if (!conversation) {
      conversation = await Conversation.create({
        participants: [senderId, receiverId],
      });
      conversation = await conversation.populate("participants", "firstName lastName email");
    }

    res.status(200).json(conversation);
  } catch (err) {
    console.error("Error creating/getting conversation:", err);
    res.status(500).json({ message: "Failed to get/create conversation" });
  }
};

/**
 * Get all conversations for current user
 * GET /api/conversations
 */
export const getUserConversations = async (req, res) => {
  try {
    const userId = req.user._id;
    if (!req.user || !userId ) {
      return res.status(401).json({ message: "Unauthorized: User not found" });
    }
    const conversations = await Conversation.find({ participants: userId })
      .populate("participants", "firstName lastName email")
      .sort({ updatedAt: -1 })
      .lean();

    res.json(conversations);
  } catch (err) {
    console.error("Error fetching conversations:", err);
    res.status(500).json({ message: "Failed to fetch conversations" });
  }
};
export const deleteConversation = async (req, res) => {
  try {
    const userId = req.user._id;
    const { conversationId } = req.params;

    // 1. Check if conversation exists
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    // 2. Verify that user is a participant
    if (!conversation.participants.includes(userId)) {
      return res.status(403).json({ message: "You are not allowed to delete this conversation" });
    }

    // 3. Delete related messages
    await Message.deleteMany({ conversationId });

    // 4. Delete the conversation
    await conversation.deleteOne();

    res.json({ message: "Conversation and related messages deleted successfully" });
  } catch (error) {
    console.error("Error deleting conversation:", error);
    res.status(500).json({ message: "Failed to delete conversation" });
  }
};