import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // who sent the message
      required: true,
    },
     conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Conversation",
    default:null,
   },
     // If it's a group message
    chatId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chat",
      default: null,
    },
    content: {
      type: String,
      trim: true,
      required: [true, "Message content is required"],
    },
    messageType: {
      type: String,
      enum: ["text", "image", "video", "file"],
      default: "text", 
    },
    attachments: [
      {
        url: String, // file/image URL
        fileName: String, // Original file name
        fileType: String, // "image", "video", "document", etc.
      },
    ],
    readBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User", // which users have read the message
      },
    ],
  },
  { timestamps: true } // auto add createdAt, updatedAt
);
// Custom validation: Must have either conversationId or chatId
messageSchema.pre("validate", function (next) {
  if (!this.conversationId && !this.chatId) {
    return next(
      new Error(
        "Message must belong to either a private conversation or a group chat."
      )
    );
  }
  next();
});

const Message = mongoose.model("Message", messageSchema);

export default Message;
