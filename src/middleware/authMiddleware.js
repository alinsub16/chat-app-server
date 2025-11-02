import jwt from "jsonwebtoken";
import User from "../models/User.js";

const protect = async (req, res, next) => {
  let token;

  try {
    // Check if Authorization header exists and starts with Bearer
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      // Extract token from "Bearer <token>"
      token = req.headers.authorization.split(" ")[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Attach user to request object (minus password)
      req.user = await User.findById(decoded.id).select("-password");

       if (!req.user) {
        return res.status(401).json({ message: "User not found" });
      }

    // Check tokenVersion
      if (decoded.tokenVersion !== req.user.tokenVersion) {
        return res.status(401).json({ message: "Token has expired. Please log in again." });
      }

      return next(); // proceed to controller
    } else {
      return res.status(401).json({ message: "Not authorized, no token provided" });
    }
  } catch (error) {
    console.error("JWT verification failed:", error.message);
    return res.status(401).json({ message: "Not authorized, token failed" });
  }
};

export default protect;
