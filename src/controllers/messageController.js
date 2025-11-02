import Message from "../models/Message.js";
import Conversation from "../models/Conversation.js";
import cloudinary from "../config/cloudinary.js";
import fs from "fs/promises";
import mongoose from "mongoose";
import Chat from "../models/chatModel.js";

/**
 * Helper: get io from Express app (set in server.js)
 */
const getIO = (req) => req.app.get("io");


/**
 * POST /api/messages
 * body: { chatId, content, messageType }
 * files: optional (req.files)
 */
export const sendMessage = async (req, res) => {
  try {
    const { content, messageType = "text", conversationId } = req.body;
    const chatId = req.params.chatId || req.body.chatId;
    const senderId = req.user._id;

    //  Validate required fields
    if (!content?.trim()) {
      return res.status(400).json({ message: "Message content is required" });
    }

    if (!chatId && !conversationId) {
      return res.status(400).json({
        message: "Either chatId (for group chat) or conversationId (for private chat) is required",
      });
    }

    let chat = null;
    let conversation = null;

    //  If group chat
    if (chatId) {
      chat = await Chat.findById(chatId).populate("users", "_id firstName lastName email");
      if (!chat) {
        return res.status(404).json({ message: "Chat not found" });
      }

      // Verify sender is a participant
      const isParticipant = chat.users.some(
        (user) => user._id.toString() === senderId.toString()
      );
      if (!isParticipant) {
        return res.status(403).json({ message: "You are not a participant of this chat" });
      }
    }
    // Check is part of the conversation
       if (conversationId) {
      conversation = await Conversation.findById(conversationId).populate(
        "participants",
        "_id firstName lastName email"
      );

      if (!conversation) {
        return res.status(404).json({ message: "Private conversation not found" });
      }

      // Verify sender is a participant in this private conversation
      const isParticipant = conversation.participants.some(
        (user) => user._id.toString() === senderId.toString()
      );

      if (!isParticipant) {
        return res.status(403).json({ message: "You are not part of this private conversation" });
      }
    }

    //  Handle file uploads (images, videos, files)
    let attachments = [];
    if (req.files && req.files.length > 0) {
      const uploadPromises = req.files.map(async (file) => {
        const result = await cloudinary.uploader.upload(file.path, {
          folder: "chat-attachments",
          resource_type: "auto",
        });
        await fs.unlink(file.path); // Delete temp file
        return {
          url: result.secure_url,
          fileName: file.originalname,
          fileType: result.resource_type,
        };
      });

      attachments = await Promise.all(uploadPromises);
    }

    // Create message
    const newMessage = await Message.create({
      sender: senderId,
      conversationId: conversationId || null,
      chatId: chatId || null,
      content,
      messageType,
      attachments,
    });

    // If it's a group chat, update last message
    if (chat) {
      chat.latestMessage = newMessage._id;
      await chat.save();

      // Update conversation records for all users
      const updatePromises = chat.users.map(async (user) => {
        const existingConversation = await Conversation.findOne({
          user: user._id,
          chat: chatId,
        });

        if (existingConversation) {
          existingConversation.latestMessage = newMessage._id;

          // Increment unread count for other users
          if (user._id.toString() !== senderId.toString()) {
            existingConversation.unreadCount += 1;
          }

          return existingConversation.save();
        } else {
          // Create a new conversation entry if not found
          return Conversation.create({
            user: user._id,
            chat: chatId,
            latestMessage: newMessage._id,
            unreadCount: user._id.toString() === senderId.toString() ? 0 : 1,
          });
        }
      });

      await Promise.all(updatePromises);
    }

    //  Emit socket events
    const io = getIO(req);
    if (io) {
      // Emit to room (group chat or private chat)
      const room = chatId || conversationId;
      io.to(room.toString()).emit("newMessage", newMessage);

      // Emit update for conversation list
      io.emit("conversationUpdated", {
        room,
        lastMessage: newMessage.content,
        updatedAt: newMessage.createdAt,
      });
    }

    res.status(201).json(newMessage);
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({ message: "Failed to send message" });
  }
};
// Get all messages for a chat
export const getMessages = async (req, res) => {
  try {
    const { chatId } = req.params;
    console.log("Incoming chatId:", chatId);

  if (!mongoose.Types.ObjectId.isValid(chatId)) {
        return res.status(400).json({ message: "Invalid chatId" });
      }
// Find messages that match either a private conversation or a group chat
    const messages = await Message.find({
      $or: [
        { conversationId: new mongoose.Types.ObjectId(chatId) }, // For private chat
        { chatId: new mongoose.Types.ObjectId(chatId) }          // For group chat
      ]
    })
      .populate("sender", "firstName lastName email")
      .sort({ createdAt: 1 });

    console.log("Messages fetched:", messages.length);
    res.json(messages);
  } catch (error) {
    console.error("Failed to fetch messages:", error);
    res.status(500).json({ message: "Failed to fetch messages" });
  }
};
// Update message content 
export const updateMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { content } = req.body;
    const userId = req.user._id;

    console.log("Message ID to update:", messageId);
    console.log("User ID:", userId);

    // Validate message ID format
    if (!mongoose.Types.ObjectId.isValid(messageId)) {
      return res.status(400).json({ message: "Invalid message ID format" });
    }

    // Check if content is provided
    if (!content || content.trim() === "") {
      return res.status(400).json({ message: "Message content is required" });
    }

    // Find the message
    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    // Check if the logged-in user is the sender
    if (message.sender.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Not authorized to update this message" });
    }

    // Update only the content
    message.content = content;
    await message.save();

    // populate sender
    await message.populate("sender", "firstName lastName email");

 // Emit update via socket
    const io = getIO(req);
    if (io) {
      const roomId = message.chatId ? message.chatId.toString() : message.conversationId?.toString();

      if (roomId) {
        io.to(roomId).emit("messageUpdated", message);
      } else {
        console.warn("⚠️ No chatId or conversationId found for message:", message._id);
      }
    }
    res.json({
      message: "Message updated successfully",
      updatedMessage: message,
    });
  } catch (error) {
    console.error("Error updating message:", error);
    res.status(500).json({ message: "Failed to update message" });
  }
};
// 🗑 Delete a message
export const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user._id;
    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(messageId)) {
      return res.status(400).json({ message: "Invalid message ID" });
    }

    // Find the message
    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

      // Only sender or admin can delete
    if (message.sender.toString() !== userId.toString() && !req.user.isAdmin) {
      return res.status(403).json({ message: "Not authorized to delete this message" });
    }

    // Determine roomId (group chat or private chat)
    const roomId = message.chatId ? message.chatId.toString() : message.conversationId?.toString();

    if (!roomId) {
      console.warn(" No chatId or conversationId found for message:", message._id);
    }

    //  Delete the message
    await Message.findByIdAndDelete(messageId);

    // Emit deletion event to room
    const io = getIO(req);
    if (io && roomId) {
      io.to(roomId).emit("messageDeleted", {
        messageId,
        roomId,
      });
    }

    return res.status(200).json({ message: "Message deleted successfully" });
  } catch (error) {
    console.error(" Error deleting message:", error);
    res.status(500).json({ message: "Failed to delete message" });
  }
};
