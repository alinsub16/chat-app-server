import { onlineUsers } from "../socket/chatSocket.js";

/**
 * @desc    Get a list of all online users
 * @route   GET /api/online-users
 */
export const getOnlineUsers = (req, res) => {
  try {
    const users = Array.from(onlineUsers.keys());

    res.status(200).json({
      success: true,
      data: {
        onlineUsers: users,
      },
    });
  } catch (error) {
    console.error("Error fetching online users:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch online users",
    });
  }
};

/**
 * @desc    Check if a specific user is online
 * @route   GET /api/online-users/:userId
 */
export const checkUserOnline = (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    const isOnline = onlineUsers.has(userId);

    res.status(200).json({
      success: true,
      data: {
        userId,
        online: isOnline,
      },
    });
  } catch (error) {
    console.error("Error checking user status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to check user status",
    });
  }
};
