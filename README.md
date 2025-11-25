# Chat API

A real-time chat and messaging application built with Node.js, Express, MongoDB, and Socket.IO. It supports user authentication, group chats, private conversations, file uploads, and real-time updates.

## Features

🧑‍💻 **User Authentication** – Register, login, update profile, change password/email.
💬 **Real-Time Messaging** – Instant chat updates with Socket.IO.
👥 **Group Chats & Private Conversations** – Organize messages by chat or individual conversations.
📂 **File Uploads** – Supports images, videos, and PDFs with multer.
✏️ **Edit & Delete Messages** – Real-time updates when messages are updated or removed.
🔐 **JWT Authentication** – Secure routes and requests.

## Tech Stack

| Technology     | Usage                        |
| -------------- | ---------------------------- |
| **Node.js**    | Runtime environment          |
| **Express.js** | REST API framework           |
| **MongoDB**    | NoSQL database for chat data |
| **Mongoose**   | MongoDB object modeling      |
| **Socket.IO**  | Real-time event handling     |
| **Multer**     | File uploads                 |
| **JWT**        | Authentication middleware    |

## Project Structure

```
src/
│
├── config/                  # Configuration files
│   ├── cloudinary.js
│   └── db.js
│
├── controllers/             # Business logic
│   ├── authController.js
│   ├── chatController.js
│   ├── conversationController.js
│   ├── messageController.js
│   ├── searchController.js
│   └── uploadController.js
│
├── middleware/              # Middleware
│   ├── authMiddleware.js
│   └── uploadMiddleware.js
│
├── models/                   # Mongoose schemas
│   ├── chatModel.js
│   ├── Conversation.js
│   ├── Message.js
│   └── User.js
│
├── routes/                   # API routes
│   ├── authRoutes.js
│   ├── chatRoutes.js
│   ├── conversationRoutes.js
│   ├── messageRoutes.js
│   ├── searchRoutes.js
│   └── uploadRoutes.js
│
├── socket/                   # Real-time communication
│   └── chatSocket.js
│
├── utils/                     # Utility functions
│   └── generateToken.js
│
├── uploads/                   # Uploaded files (ignored by git)
│
├── app.js                      # Express app setup
├── server.js                   # Server and Socket.IO initialization
└── README.md
```

## API Endpoints

### Auth Routes (User Management)

| Action              | Method | Endpoint                        | Body Example                                                                                                            |
| ------------------- | ------ | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Register User**   | POST   | `/api/auth/register`            | `{ "firstName": "John", "lastName": "Doe", "email": "john@example.com", "number": "1234567890", "password": "123456" }` |
| **Login User**      | POST   | `/api/auth/login`               | `{ "email": "john@example.com", "password": "123456" }`                                                                 |
| **Get Profile**     | GET    | `/api/auth/profile`             | Headers: `Authorization: Bearer <token>`                                                                                |
| **Update Profile**  | PUT    | `/api/auth/me`                  | Headers: `Authorization: Bearer <token>`                                                                                |
| **Change Password** | PUT    | `/api/auth/me`                  | `{ "currentPassword": "oldpass", "password": "newpass" }`                                                               |
| **Change Email**    | PUT    | `/api/auth/me`                  | `{ "currentPassword": "oldpass", "email": "newemail@example.com" }`                                                     |
| **Search User**     | GET    | `/api/search/users?query=chris` | Headers: `Authorization: Bearer <token>`                                                                                |

### Chat Routes (Group Chat Management)

| Action           | Method | Endpoint                        | Body Example                                                        |
| ---------------- | ------ | ------------------------------- | ------------------------------------------------------------------- |
| **Create Chat**  | POST   | `/api/chats`                    | `{ "chatName": "My Group", "members": ["<userId1>", "<userId2>"] }` |
| **Get My Chats** | GET    | `/api/chats`                    | Headers: `Authorization: Bearer <token>`                            |
| **Add Member**   | PUT    | `/api/chats/:chatId/add-member` | `{ "userId": "_id" }`                                               |

### Message Routes (Chat Messages)

| Action                | Method | Endpoint                   | Body Example                                                                                                                     |
| --------------------- | ------ | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **Send Message**      | POST   | `/api/messages/`           | `form-data`:<br> - `chatId`: `<chatId>`<br> - `content`: `"Hello!"`<br> - `messageType`: `"text"`<br> - `files`: `[file upload]` |
| **Get Chat Messages** | GET    | `/api/messages/:chatId`    | Headers: `Authorization: Bearer <token>`                                                                                         |
| **Update Message**    | PUT    | `/api/messages/:messageId` | `{ "content": "Hello, how are you?" }`                                                                                           |
| **Delete Message**    | DELETE | `/api/messages/:messageId` | Headers: `Authorization: Bearer <token>`                                                                                         |

### Conversation Routes (Private Chat)

| Action                 | Method | Endpoint              | Body Example                             |
| ---------------------- | ------ | --------------------- | ---------------------------------------- |
| **Start Conversation** | POST   | `/api/conversations/` | `{ "receiverId": "<userId>" }`           |
| **Get Conversations**  | GET    | `/api/conversations/` | Headers: `Authorization: Bearer <token>` |

### Test Route

| Action       | Method | Endpoint    |
| ------------ | ------ | ----------- |
| **Test API** | GET    | `/api/test` |

## Socket.IO Events

| Event            | Direction       | Description                          |
| ---------------- | --------------- | ------------------------------------ |
| `joinChat`       | Client → Server | Join a chat room by `chatId`.        |
| `messageSent`    | Server → Client | Broadcast when a message is sent.    |
| `messageUpdated` | Server → Client | Broadcast when a message is updated. |
| `messageDeleted` | Server → Client | Broadcast when a message is deleted. |

```js
// Connect to socket
const socket = io("http://localhost:5000");

// Join a chat
socket.emit("joinChat", chatId);

// Listen for messages
socket.on("messageSent", (msg) => {
  console.log("New message:", msg);
});

socket.on("messageUpdated", (msg) => {
  console.log("Message updated:", msg);
});

socket.on("messageDeleted", (msg) => {
  console.log("Message deleted:", msg.messageId);
});
```

## Contributors

**Christopher Alinsub** – Backend Developer
