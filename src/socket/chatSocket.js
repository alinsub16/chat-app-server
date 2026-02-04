// src/socket/chatSocket.js
import mongoose from "mongoose";
import { socketAuth } from "../middleware/socketAuthMiddleware.js";
import Message from "../models/Message.js";
import Conversation from "../models/Conversation.js";
import Chat from "../models/chatModel.js";

const onlineUsers = new Map(); // userId -> [socketIds]
export { onlineUsers };

export default function chatSocket(io) {

  /**
   * SOCKET.IO AUTH MIDDLEWARE
   * Reject unauthenticated connections
   */
  io.use((socket, next) => {
    socketAuth(socket, (err) => {
      if (err || !socket.user) {
        return next(new Error("Authentication error"));
      }
      next();
    });
  });

  io.on("connection", (socket) => {
    const userId = socket.user?.id;

    console.log(`⚡ User connected: ${socket.id} (User ID: ${userId || 'Unknown'})`);

    /**
     * Track user sockets
     */
    if (userId) {
      if (!onlineUsers.has(userId)) {
        onlineUsers.set(userId, []);
      }
      onlineUsers.get(userId).push(socket.id);

      // Notify all clients that a user came online
      io.emit("userOnline", { userId });


      // Send the current list of online users to the newly connected client
      socket.emit("onlineUsers", Array.from(onlineUsers.keys()));
    }

    /**
     * CLIENT REQUEST: Get list of all online users
     */
    socket.on("getOnlineUsers", () => {
      const userIds = Array.from(onlineUsers.keys());
      socket.emit("onlineUsers", userIds);
    });

    /**
     * JOIN CHAT ROOM
     */
    socket.on("joinChat", async (chatId) => {
      try {
        if (!chatId) {
          return socket.emit("errorMessage", { error: "Chat ID is required to join." });
        }

        const groupChat = await Chat.findById(chatId).populate("users", "_id");
        if (!groupChat) {
          return socket.emit("errorMessage", { error: "Group chat not found" });
        }

        const userIds = groupChat.users.map(u => u._id.toString());
        if (!userIds.includes(userId.toString())) {
          return socket.emit("errorMessage", { error: "Unauthorized to join this chat" });
        }

        socket.join(chatId);
        console.log(` User ${userId} joined chat room: ${chatId}`);
      } catch (error) {
        console.error(" Error joining chat:", error.message);
        socket.emit("errorMessage", { error: "Failed to join chat" });
      }
    });

    /**
     * SEND MESSAGE
     */
    socket.on("sendMessage", async (data) => {
      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        const { chatId, conversationId, message, attachments = [] } = data;

        if (!userId) {
          socket.emit("errorMessage", { error: "User not authenticated" });
          return;
        }

        // Validation
        if (conversationId && chatId) {
          socket.emit("errorMessage", { error: "Provide either conversationId or chatId, not both" });
          return;
        }

        if ((!conversationId && !chatId) || (!message && attachments.length === 0)) {
          socket.emit("errorMessage", { error: "Invalid message data" });
          return;
        }

        let roomId = "";
        let participants = [];

        // Private conversation
        if (conversationId) {
          const conversation = await Conversation.findById(conversationId);
          if (!conversation) {
            socket.emit("errorMessage", { error: "Conversation not found" });
            return;
          }

          const participantIds = conversation.participants.map(p => p.toString());
          if (!participantIds.includes(userId.toString())) {
            socket.emit("errorMessage", { error: "User not part of this conversation" });
            return;
          }

          roomId = conversationId;
          participants = participantIds;
        }

        // Group chat
        if (chatId) {
          const groupChat = await Chat.findById(chatId).populate("users", "_id");
          if (!groupChat) {
            socket.emit("errorMessage", { error: "Group chat not found" });
            return;
          }

          const userIds = groupChat.users.map(u => u._id.toString());
          if (!userIds.includes(userId.toString())) {
            socket.emit("errorMessage", { error: "User not part of this group chat" });
            return;
          }

          roomId = chatId;
          participants = userIds;
        }

        // Create message
        const [newMessage] = await Message.create([{
          sender: userId,
          conversationId: conversationId || null,
          chat: chatId || null,
          content: message || "",
          messageType: attachments.length > 0 ? "file" : "text",
          attachments,
        }], { session });

        // Update latest message
        if (conversationId) {
          await Conversation.findByIdAndUpdate(conversationId, { lastMessage: newMessage.content }, { session });
        } else if (chatId) {
          await Chat.findByIdAndUpdate(chatId, { latestMessage: newMessage._id }, { session });
        }

        await session.commitTransaction();

        // Populate before sending
        const populatedMessage = await Message.findById(newMessage._id)
          .populate("sender", "firstName lastName email")
          .populate("conversationId", "participants")
          .populate("chat", "users chatName isGroupChat");

        // Emit to everyone in the room except sender
        socket.to(roomId).emit("receiveMessage", populatedMessage);

        // Confirm to sender
        socket.emit("messageSent", populatedMessage);

      } catch (error) {
        await session.abortTransaction();
        console.error("Error sending message:", error.message);
        socket.emit("errorMessage", { error: "Failed to send message" });
      } finally {
        session.endSession();
      }
    });

    /**
     * LEAVE CHAT ROOM
     */
    socket.on("leaveChat", (chatId) => {
      if (!chatId) {
        return socket.emit("errorMessage", { error: "Chat ID is required to leave." });
      }
      socket.leave(chatId);
      console.log(`🚪 User ${userId} left chat room: ${chatId}`);
    });

    /**
     * DISCONNECT HANDLER
     * Grace period to prevent rapid disconnect/reconnect issues
     */
    socket.on("disconnect", () => {
      console.log(`Client disconnected: ${socket.id}`);

      if (!userId) return;

      const userSockets = onlineUsers.get(userId) || [];
      const updatedSockets = userSockets.filter(id => id !== socket.id);

      if (updatedSockets.length > 0) {
        onlineUsers.set(userId, updatedSockets);
      } else {
        // Wait 3 seconds before marking user offline
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

