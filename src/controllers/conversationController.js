import mongoose from "mongoose";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import Chat from "../models/chatModel.js";
/**
 * Create or get a 1-on-1 conversation
 * POST /api/conversations
 * body: { receiverId }
 */
export const createOrGetConversation = async (req, res) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const senderId = req.user._id;
    const { receiverId } = req.body;

    if (!receiverId || !mongoose.Types.ObjectId.isValid(receiverId)) {
      return res.status(400).json({ message: "Valid receiverId required" });
    }

    // ALWAYS SORT 
    const participants = [senderId, receiverId]
      .map(id => id.toString())
      .sort();

    // ATOMIC UPSERT (no duplicates EVER)
    const conversation = await Conversation.findOneAndUpdate(
      { participants },
      { $setOnInsert: { participants } },
      { new: true, upsert: true }
    ).populate("participants", "firstName lastName email");

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
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized: User not found" });
    }

    // 1. Fetch 1:1 conversations (optimized)
    const conversations = await Conversation.find({ participants: userId })
      .populate("participants", "firstName lastName profilePicture")
      .populate({
        path: "latestMessage",
        populate: {
          path: "sender",
          select: "firstName lastName profilePicture",
        },
      })
      .sort({ updatedAt: -1 }) // 🔥 correct ordering
      .lean();

    // Normalize 1:1 conversations
    const formattedConversations = conversations.map((conv) => ({
      ...conv,
      isGroupChat: false,
    }));

    // 2. Fetch group chats (optimized)
    const groupChats = await Chat.find({ users: userId })
      .populate("users", "firstName lastName profilePicture")
      .populate("groupAdmin", "firstName lastName profilePicture")
      .populate({
        path: "latestMessage",
        populate: {
          path: "sender",
          select: "firstName lastName profilePicture",
        },
      })
      .sort({ updatedAt: -1 })
      .lean();

    // Normalize group chats
    const formattedGroupChats = groupChats.map((chat) => ({
      _id: chat._id,
      chatName: chat.chatName,
      participants: chat.users,
      latestMessage: chat.latestMessage || null,
      isGroupChat: true,
      groupAdmin: chat.groupAdmin,
      updatedAt: chat.updatedAt,
      createdAt: chat.createdAt,
    }));

    //  3. Merge + FINAL SORT (safety)
    const allChats = [...formattedConversations, ...formattedGroupChats].sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() -
        new Date(a.updatedAt).getTime()
    );

    res.json({ chats: allChats });
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