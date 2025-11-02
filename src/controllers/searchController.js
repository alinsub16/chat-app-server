import User from "../models/User.js";

//  Search for users by name or email
export const searchUsers = async (req, res) => {
  try {
    const { query } = req.query; // e.g., /api/users/search?query=chris

    if (!query) {
      return res.status(400).json({ message: "Please provide a search query" });
    }

    // Search in firstName, lastName, and email
    const users = await User.find({
      $or: [
        { firstName: { $regex: query, $options: "i" } },
        { lastName: { $regex: query, $options: "i" } },
        { email: { $regex: query, $options: "i" } },
      ],
    }).select("-password"); // exclude password

    res.json(users);
  } catch (error) {
    console.error("Search error:", error);
    res.status(500).json({ message: "Failed to search users" });
  }
};
