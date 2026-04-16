import { onlineUsers } from "../socket/chatSocket.js";

export const getOnlineUsers = (req, res) => {
  try {
    const users = Array.from(onlineUsers.values()).map((u) => ({
        userId: u.userId,
        firstName: u.user.firstName,
        lastName: u.user.lastName,
        profilePicture: u.user.profilePicture,
      }));

    res.status(200).json({
      success: true,
      data: {
        onlineUsers: users,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed",
    });
  }
};

export const checkUserOnline = (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    const isOnline =
      onlineUsers.has(userId) &&
      onlineUsers.get(userId)?.socketIds?.length > 0;

    res.status(200).json({
      success: true,
      data: {
        userId,
        online: isOnline,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to check user status",
    });
  }
};