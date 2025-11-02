// utils/generateToken.js
import jwt from "jsonwebtoken";

/**
 * Generates a JWT token for a user
 * @param {string} userId - The user's unique MongoDB _id
 * @param {number} tokenVersion - The token version to invalidate old tokens
 * @returns {string} - Signed JWT token
 */
const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, tokenVersion: user.tokenVersion }, // payload
    process.env.JWT_SECRET,       // secret key
    { expiresIn: "7d" }           // token valid for 7 days
  );
};

export default generateToken;
