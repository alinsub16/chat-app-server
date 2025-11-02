// src/server.js
import http from "http";
import { Server } from "socket.io";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import app from "./app.js";
import connectDB from "./config/db.js";
import chatSocket from "./socket/chatSocket.js";


// Load environment variables
dotenv.config();

// Connect to MongoDB
connectDB();

// Define port
const PORT = process.env.PORT || 5000;

// Create HTTP server using Express app
const server = http.createServer(app);

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL,
    methods: ["GET", "POST", "PUT", "DELETE"], //  All required HTTP methods
    credentials: true, // Optional: Allow cookies or auth headers if needed
  },
});

// Make io available in controllers
app.set("io", io);
//  Socket.IO Authentication Middleware
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth.token; // token sent from frontend

    if (!token) {
      console.log(" No token provided");
      return next(new Error("Authentication error: No token provided"));
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded || !decoded.id) {
      console.log("Socket connection rejected: Token missing user ID");
      return next(new Error("Authentication error: Invalid token payload"));
    }

    // Attach decoded user data to the socket
    socket.user = decoded;

    console.log(` User authenticated: ${decoded.id}`);
    next();
  } catch (error) {
    console.error("Socket auth error:", error.message);
    next(new Error("Authentication error: Invalid token"));
  }
});

/**
 * Handle Socket.IO connections
 */
io.on("connection", (socket) => {
  console.log(
    `⚡ New client connected: ${socket.id} (User ID: ${socket.user?.id || "Unknown"})`
  );

  socket.on("disconnect", () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

// Handle Socket.IO connections
chatSocket(io);

/**
 * Global Express Error Handling
 */
app.use((err, req, res, next) => {
  console.error("Global error handler:", err.stack);
  res.status(500).json({ message: "Server Error", error: err.message });
});

// Start the server
server.listen(PORT, () => {
  console.log(` Server running on port ${PORT}`);
});
