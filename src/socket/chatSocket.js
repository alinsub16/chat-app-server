// src/socket/chatSocket.js
import mongoose from "mongoose";
import { socketAuth } from "../middleware/socketAuthMiddleware.js";
import Message from "../models/Message.js";
import Conversation from "../models/Conversation.js";
import Chat from "../models/chatModel.js";

const onlineUsers = new Map(); // userId -> [socketIds]
export { onlineUsers };

export default function chatSocket(io) {

  io.use((socket, next) => {
    socketAuth(socket, (err) => {
      if (err || !socket.user) return next(new Error("Authentication error"));
      next();
    });
  });

  io.on("connection", (socket) => {
    const userId = socket.user?.id;
    console.log(`⚡ User connected: ${socket.id} (User ID: ${userId || 'Unknown'})`);

    if (userId) {
      if (!onlineUsers.has(userId)) onlineUsers.set(userId, []);
      onlineUsers.get(userId).push(socket.id);

      io.emit("userOnline", { userId });
      socket.emit("onlineUsers", Array.from(onlineUsers.keys()));
    }

    socket.on("getOnlineUsers", () => {
      socket.emit("onlineUsers", Array.from(onlineUsers.keys()));
    });

    // --- JOIN / LEAVE CHAT ROOMS ---
    socket.on("joinChat", async (chatId) => {
      try {
        if (!chatId) return socket.emit("errorMessage", { error: "Chat ID is required to join." });

        const groupChat = await Chat.findById(chatId).populate("users", "_id");
        if (!groupChat) return socket.emit("errorMessage", { error: "Group chat not found" });

        const userIds = groupChat.users.map(u => u._id.toString());
        if (!userIds.includes(userId.toString())) {
          return socket.emit("errorMessage", { error: "Unauthorized to join this chat" });
        }

        socket.join(chatId);
        console.log(` User ${userId} joined chat room: ${chatId}`);
      } catch (err) {
        console.error(" Error joining chat:", err.message);
        socket.emit("errorMessage", { error: "Failed to join chat" });
      }
    });

    socket.on("leaveChat", (chatId) => {
      if (!chatId) return socket.emit("errorMessage", { error: "Chat ID is required to leave." });
      socket.leave(chatId);
      console.log(`🚪 User ${userId} left chat room: ${chatId}`);
    });

    // --- CREATE / DELETE CONVERSATIONS ---
    socket.on("conversation:create", async (newConv) => {
      try {
        const participantIds = newConv.participants || [];
        participantIds.forEach(id => {
          if (onlineUsers.has(id)) {
            onlineUsers.get(id).forEach(sockId => {
              io.to(sockId).emit("conversation:created", newConv);
            });
          }
        });
      } catch (err) {
        console.error("Error broadcasting conversation:create:", err.message);
      }
    });

    socket.on("conversation:delete", async ({ convId, participantIds }) => {
      try {
        participantIds.forEach(id => {
          if (onlineUsers.has(id)) {
            onlineUsers.get(id).forEach(sockId => {
              io.to(sockId).emit("conversation:deleted", convId);
            });
          }
        });
      } catch (err) {
        console.error("Error broadcasting conversation:deleted:", err.message);
      }
    });

    // --- TYPING EVENTS ---
    socket.on("typing", ({ conversationId, isTyping }) => {
      socket.to(conversationId).emit("userTyping", { userId, conversationId, isTyping });
    });

    // --- SEND MESSAGE ---
    socket.on("sendMessage", async (data) => {
      const session = await mongoose.startSession();
      session.startTransaction();
      try {
        const { chatId, conversationId, message, attachments = [] } = data;
        if (!userId) return socket.emit("errorMessage", { error: "User not authenticated" });
        if (conversationId && chatId) return socket.emit("errorMessage", { error: "Provide either conversationId or chatId, not both" });
        if ((!conversationId && !chatId) || (!message && attachments.length === 0)) {
          return socket.emit("errorMessage", { error: "Invalid message data" });
        }

        let roomId = "";
        let participants = [];

        if (conversationId) {
          const conversation = await Conversation.findById(conversationId);
          if (!conversation) return socket.emit("errorMessage", { error: "Conversation not found" });
          const participantIds = conversation.participants.map(p => p.toString());
          if (!participantIds.includes(userId.toString())) return socket.emit("errorMessage", { error: "User not part of this conversation" });
          roomId = conversationId;
          participants = participantIds;
        } else if (chatId) {
          const groupChat = await Chat.findById(chatId).populate("users", "_id");
          if (!groupChat) return socket.emit("errorMessage", { error: "Group chat not found" });
          const userIds = groupChat.users.map(u => u._id.toString());
          if (!userIds.includes(userId.toString())) return socket.emit("errorMessage", { error: "User not part of this group chat" });
          roomId = chatId;
          participants = userIds;
        }

        const [newMessage] = await Message.create([{
          sender: userId,
          conversationId: conversationId || null,
          chat: chatId || null,
          content: message || "",
          messageType: attachments.length > 0 ? "file" : "text",
          attachments,
        }], { session });

        if (conversationId) await Conversation.findByIdAndUpdate(conversationId, { lastMessage: newMessage.content }, { session });
        else if (chatId) await Chat.findByIdAndUpdate(chatId, { latestMessage: newMessage._id }, { session });

        await session.commitTransaction();

        const populatedMessage = await Message.findById(newMessage._id)
          .populate("sender", "firstName lastName email")
          .populate("conversationId", "participants")
          .populate("chat", "users chatName isGroupChat");

        socket.to(roomId).emit("receiveMessage", populatedMessage);
        socket.emit("messageSent", populatedMessage);
      } catch (err) {
        await session.abortTransaction();
        console.error("Error sending message:", err.message);
        socket.emit("errorMessage", { error: "Failed to send message" });
      } finally {
        session.endSession();
      }
    });

    // --- DISCONNECT ---
    socket.on("disconnect", () => {
      console.log(`Client disconnected: ${socket.id}`);
      if (!userId) return;

      const userSockets = onlineUsers.get(userId) || [];
      const updatedSockets = userSockets.filter(id => id !== socket.id);

      if (updatedSockets.length > 0) onlineUsers.set(userId, updatedSockets);
      else {
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
