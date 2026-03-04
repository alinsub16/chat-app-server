import express from "express";
import {uploadChatAttachments} from "../controllers/uploadController.js";
import { uploadGeneral } from "../middleware/uploadMiddleware.js";
import protect from "../middleware/authMiddleware.js";

const router = express.Router();

// -----------------------------
// Upload chat attachments (multiple files)
// Requires auth
// -----------------------------
router.post(
  "/attachment",
  protect,
  uploadGeneral.array("files", 5),
  uploadChatAttachments
);

export default router;