import jwt from "jsonwebtoken";
import User from "../models/User.js";

// Helper to extract token safely
const getToken = (socket) => {
  // 1. From handshake.auth
  if (socket.handshake.auth?.token) return socket.handshake.auth.token;

  // 2. From Authorization header
  const authHeader = socket.handshake.headers?.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.split(" ")[1];
  }

  return null;
};

export const socketAuth = async (socket, next) => {

  try {
    const token = getToken(socket);

    if (!token) {
      return next(new Error("Authentication error: Token missing"));
    }

    // Verify JWT
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      if (error.name === "TokenExpiredError") {
        return next(new Error("Authentication error: Token expired"));
      }
      return next(new Error("Authentication error: Invalid token"));
    }

    // Find the user in the database
    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      return next(new Error("Authentication error: User not found"));
    }

    // Attach authenticated user to socket
    socket.user = {
      id: user._id.toString(),
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
    };

    // Debugging logs (remove in production)
    console.log("Socket authenticated:", socket.user);
    console.log("socketAuth running...");

    // Allow connection to proceed
    next();
  } catch (error) {
    console.error("Socket authentication failed:", error.message);
    return next(new Error("Authentication error"));
  }
};
