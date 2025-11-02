import multer from "multer";
import path from "path";
import fs from "fs";

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = "uploads/";

    // Create uploads folder if not exists
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }

    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + "-" + file.originalname.replace(/\s+/g, "_");
    cb(null, uniqueName);
  },
});

//  General file filter (for PDFs, videos, images, etc.)
const generalFileFilter = (req, file, cb) => {
  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "video/mp4",
    "application/pdf",
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    console.error(" Invalid file type detected:", file.mimetype);
    cb(new Error("Invalid file type. Only images, videos, and PDFs are allowed."), false);
  }
};

//  Strict image-only filter (for profile pictures)
const imageFileFilter = (req, file, cb) => {
  const allowedTypes = ["image/jpeg", "image/png", "image/jpg", "image/webp"];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    console.error(" Invalid image file type detected:", file.mimetype);
    cb(new Error("Invalid file type. Only JPEG, PNG, and WEBP images are allowed."), false);
  }
};

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB

//  Multer instances
export const uploadGeneral = multer({
  storage,
  fileFilter: generalFileFilter,
  limits: { fileSize: MAX_FILE_SIZE * 5 }, // Allow bigger size for general uploads
});

export const uploadImage = multer({
  storage,
  fileFilter: imageFileFilter,
  limits: { fileSize: MAX_FILE_SIZE }, // 2MB max for profile pictures
});
