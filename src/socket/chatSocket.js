import mongoose from "mongoose";
import { socketAuth } from "../middleware/socketAuthMiddleware.js";
import Message from "../models/Message.js";
import Conversation from "../models/Conversation.js";
import Chat from "../models/chatModel.js";

const onlineUsers = new Map();
export { onlineUsers };

export default function chatSocket(io) {
  // ===============================
  // AUTH MIDDLEWARE
  // ===============================
  io.use((socket, next) => {
    socketAuth(socket, (err) => {
      if (err || !socket.user) {
        return next(new Error("Authentication error"));
      }
      next();
    });
  });

  io.on("connection", async (socket) => {
    const userId = socket.user?.id;
    console.log(`⚡ User connected: ${socket.id} (User ID: ${userId})`);

    if (!userId) return;

    // ===============================
    // TRACK ONLINE USERS
    // ===============================
    if (!onlineUsers.has(userId)) onlineUsers.set(userId, []);
    onlineUsers.get(userId).push(socket.id);

    io.emit("userOnline", { userId });
    socket.emit("onlineUsers", Array.from(onlineUsers.keys()));

    // ===============================
    // AUTO JOIN USER ROOMS
    // ===============================
    try {
      const conversations = await Conversation.find({
        participants: userId,
      }).select("_id");

      conversations.forEach((conv) =>
        socket.join(conv._id.toString())
      );

      const groupChats = await Chat.find({
        users: userId,
      }).select("_id");

      groupChats.forEach((chat) =>
        socket.join(chat._id.toString())
      );

      console.log(
        `✅ User ${userId} auto-joined ${
          conversations.length + groupChats.length
        } rooms`
      );
    } catch (err) {
      console.error("Auto-join error:", err.message);
    }

    // ===============================
    // JOIN / LEAVE CHAT
    // ===============================
    socket.on("joinChat", (roomId) => {
      if (!roomId) return;
      socket.join(roomId);
      console.log(`User ${userId} joined room: ${roomId}`);
    });

    socket.on("leaveChat", (roomId) => {
      if (!roomId) return;
      socket.leave(roomId);
      console.log(`🚪 User ${userId} left room: ${roomId}`);
    });

    // ===============================
    // TYPING EVENTS
    // ===============================
    socket.on("typing", ({ roomId, isTyping }) => {
      if (!roomId) return;

      // Emit to all other users in the room
      socket.to(roomId).emit("typing", {
        conversationId: roomId, // ⚠ must match frontend key
        userId,
        isTyping,
      });
    });
    // ===============================
    // SEND MESSAGE (SOCKET OWNS SAVE)
    // ===============================
    socket.on("sendMessage", async (data) => {
      try {
        const {
          content,
          attachments = [],
          conversationId,
          chatId,
          messageType = "text",
          clientTempId,
        } = data;

        const roomId = conversationId || chatId;

        if (!roomId) {
          return socket.emit("errorMessage", {
            error: "Room ID required",
          });
        }

        if (!content?.trim() && attachments.length === 0) {
          return socket.emit("errorMessage", {
            error: "Message content or attachment required",
          });
        }

        // 🔥 Create message in DB
        let newMessage = await Message.create({
          sender: userId,
          conversationId: conversationId || null,
          chatId: chatId || null,
          content: content || "",
          messageType,
          attachments,
        });

        await newMessage.populate(
          "sender",
          "_id firstName lastName email"
        );

        // 🔥 Emit to all users in room (including sender)
        io.to(roomId).emit("receiveMessage", {
          ...newMessage.toObject(),
          clientTempId, // used to replace optimistic message
        });

        console.log(`💬 Message saved & emitted to room ${roomId}`);
      } catch (err) {
        console.error("Socket sendMessage error:", err.message);
        socket.emit("errorMessage", {
          error: "Failed to send message",
        });
      }
    });

    // ===============================
    // UPDATE MESSAGE
    // ===============================
    socket.on("updateMessage", async ({ messageId, content }) => {
      try {
        if (!mongoose.Types.ObjectId.isValid(messageId)) {
          return socket.emit("errorMessage", {
            error: "Invalid message ID",
          }); 
        }

        const message = await Message.findById(messageId);
        if (!message) {
          return socket.emit("errorMessage", {
            error: "Message not found",
          });
        }

        // Only sender can update
        if (message.sender.toString() !== userId.toString()) {
          return socket.emit("errorMessage", {
            error: "Unauthorized",
          });
        }

        message.content = content;
        await message.save();

        const roomId =
          message.chatId?.toString() ||
          message.conversationId?.toString();

        const populatedMessage = await Message.findById(message._id)
        .populate("sender", "firstName lastName profilePicture");

        io.to(roomId).emit("messageUpdated", populatedMessage);

        console.log(` Message ${messageId} updated`);
      } catch (err) {
        console.error("Socket updateMessage error:", err.message);
      }
    });

    // ===============================
    // DELETE MESSAGE
    // ===============================
    socket.on("deleteMessage", async ({ messageId, roomId: clientRoomId }) => {
      try {
        if (!mongoose.Types.ObjectId.isValid(messageId)) {
          return socket.emit("errorMessage", { error: "Invalid message ID" });
        }

        const message = await Message.findById(messageId);
        if (!message) {
          return socket.emit("errorMessage", { error: "Message not found" });
        }

        // Only sender can delete
        if (message.sender.toString() !== userId.toString()) {
          return socket.emit("errorMessage", { error: "Unauthorized" });
        } 

        // Prefer client-provided roomId
        const roomId = clientRoomId || message.chatId?.toString() || message.conversationId?.toString();
        if (!roomId) {
          return socket.emit("errorMessage", { error: "Room ID required" });
        }

        await Message.findByIdAndDelete(messageId);

        io.to(roomId).emit("messageDeleted", { messageId });

        console.log(`🗑 Message ${messageId} deleted`);
      } catch (err) {
        console.error("Socket deleteMessage error:", err.message);
      }
    });

    // ===============================
    // React to Message
    // ===============================
    socket.on("reactMessage", async ({ messageId, emoji }) => {
      try {

        const message = await Message.findById(messageId);

        if (!message) return;

        const existing = message.reactions.find(
          (r) =>
            r.user.toString() === userId &&
            r.emoji === emoji
        );

        if (existing) {
          // remove reaction (toggle)
          message.reactions = message.reactions.filter(
            (r) =>
              !(
                r.user.toString() === userId &&
                r.emoji === emoji
              )
          );
        } else {
          message.reactions.push({
            user: userId,
            emoji
          });
        }

        await message.save();

        const roomId =
          message.chatId?.toString() ||
          message.conversationId?.toString();

        io.to(roomId).emit("messageReactionUpdated", {
          messageId,
          reactions: message.reactions
        });

      } catch (err) {
        console.error("Reaction error:", err);
      }
    });

    // ===============================
    // DISCONNECT
    // ===============================
    socket.on("disconnect", () => {
      console.log(`Client disconnected: ${socket.id}`);

      const userSockets = onlineUsers.get(userId) || [];
      const updatedSockets = userSockets.filter(
        (id) => id !== socket.id
      );

      if (updatedSockets.length > 0) {
        onlineUsers.set(userId, updatedSockets);
      } else {
        setTimeout(() => {
          const currentSockets = onlineUsers.get(userId);
          if (!currentSockets || currentSockets.length === 0) {
            onlineUsers.delete(userId);
            io.emit("userOffline", { userId });
            console.log(`User offline: ${userId}`);
          }
        }, 3000);
      }
    });
  });
}