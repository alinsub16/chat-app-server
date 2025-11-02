import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
  {
    // Two users in the conversation
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],

    // Track the latest message for quick access
    latestMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
    },
  },
  { timestamps: true } // adds createdAt, updatedAt
);

export default mongoose.model("Conversation", conversationSchema);
