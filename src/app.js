// src/app.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./routes/authRoutes.js"; 
import chatRoutes from "./routes/chatRoutes.js";
import messageRoutes from "./routes/messageRoutes.js";
import searchRoutes from "./routes/searchRoutes.js";
import conversationRoutes from "./routes/conversationRoutes.js";
import onlineStatusRoutes from "./routes/onlineRoutes.js";

// Load environment variables
dotenv.config();

const app = express();

// Middleware
app.use(express.json()); // Parse JSON request bodies
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173", //  Allow your frontend
  methods: ["GET", "POST", "PUT", "DELETE"],        
  credentials: true, //  Allow cookies and headers like Authorization
}));

//  Example route for testing
app.get("/api/test", (req, res) => {
  res.json({ message: "API is working " });
});

// Authentication routes
app.use("/api/auth", authRoutes);
app.use("/api/chats", chatRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/conversations", conversationRoutes);
app.use("/api/online-users", onlineStatusRoutes);


//  Global error handler
app.use((err, req, res, next) => {
  console.error("Server Error:", err.stack);
  res.status(err.status || 500).json({
    message: err.message || "Internal Server Error",
  });
});

export default app;

