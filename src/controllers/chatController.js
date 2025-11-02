import Chat from "../models/chatModel.js";
import User from "../models/User.js";
import Message from "../models/Message.js";

export const createChat = async (req, res) => {
  try {
    const { chatName, members } = req.body;

    // 1. Validate basic inputs
    if (!chatName || !members || members.length < 2) {
      return res.status(400).json({
        message: "At least 2 members are required to create a group chat."
      });
    }

    // 2. Normalize provided members (convert to strings)
    const normalizedMembers = members.map(m => m.toString());

    // 3. Ensure logged-in user is included, but don't add twice
    const creatorId = req.user._id.toString();
    if (!normalizedMembers.includes(creatorId)) {
      normalizedMembers.push(creatorId);
    }

    // 4. Check for duplicates
    const uniqueMembers = [...new Set(normalizedMembers)];

    if (uniqueMembers.length !== normalizedMembers.length) {
      return res.status(400).json({
        message: "Duplicate members detected. Each member must be unique."
      });
    }

    // 5. Ensure minimum group size (2 other members + creator = 3 total)
    if (uniqueMembers.length < 3) {
      return res.status(400).json({
        message: "A group chat must have at least 2 other members plus yourself."
      });
    }

    // 6. Create the group chat
    const newChat = await Chat.create({
      chatName,
      isGroupChat: true,
      users: uniqueMembers,
      groupAdmin: req.user._id,
    });

    // 7. Populate and return
    const fullChat = await Chat.findById(newChat._id)
      .populate("users", "firstName lastName email")
      .populate("groupAdmin", "firstName lastName email");

    return res.status(201).json(fullChat);

  } catch (error) {
    console.error("Error creating group chat:", error);
    return res.status(500).json({ message: "Failed to create chat" });
  }
};


// Get all chats for logged-in user
export const getUserChats = async (req, res) => {
  try {
    const chats = await Chat.find({ users: req.user._id })
      .populate("users", "firstName lastName email")
      .populate("groupAdmin", "firstName lastName email");

    res.json(chats);
  } catch (error) {
    console.error("Get Chats Error:", error);
    res.status(500).json({ message: "Failed to fetch chats" });
  }
};
//  Add a member to a group chat
export const addMemberToGroup = async (req, res) => {
  try {
    const { chatId, userId } = req.body;
    const currentUserId = req.user._id; 

    // Validate inputs
    if (!chatId || !userId) {
      return res.status(400).json({ message: "chatId and userId are required" });
    }

    // Find the group chat
    const chat = await Chat.findById(chatId);

    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    // Ensure it's a group chat
    if (!chat.isGroupChat) {
      return res.status(400).json({ message: "Cannot add members to a direct chat" });
    }
    //Ensure the current user is a member of this group
    if (!chat.users.some(user => user.toString() === currentUserId.toString())) {
      return res.status(403).json({
        message: "You must be a member of this group to add new members",
      });
    }
    // Check if user is already in the group
    if (chat.users.includes(userId)) {
      return res.status(400).json({ message: "User is already a member of this group" });
    }

    // Add the user to the group
    chat.users.push(userId);
    await chat.save();

    const updatedChat = await Chat.findById(chatId)
      .populate("users", "firstName lastName email")
      .populate("groupAdmin", "firstName lastName email");

    res.status(200).json({
      message: "User added successfully",
      chat: updatedChat,
    });
  } catch (error) {
    console.error("Error adding member to group:", error);
    res.status(500).json({ message: "Server error" });
  }
};
export const deleteGroupChat = async (req, res) => {
  try {
    const userId = req.user._id;
    const { chatId } = req.params;

    // 1. Check if the group chat exists
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    // 2. Verify that the user is a participant
    const isParticipant = chat.users.some(user => user.toString() === userId.toString());
    if (!isParticipant) {
      return res.status(403).json({ message: "You are not allowed to delete this conversation" });
    }

    // 3. Delete related messages first
    await Message.deleteMany({ chatId: chat._id });

    // 4. Delete the chat itself
    await chat.deleteOne(); 

    res.json({ message: "Group Chat and related messages deleted successfully" });
  } catch (error) {
    console.error("Error deleting group chat:", error);
    res.status(500).json({ message: "Failed to delete group chat" });
  }
};
