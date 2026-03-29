import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
      trim: true,
    },

    lastName: {
      type: String,
      required: true,
      trim: true,
    },

    middleName: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please enter a valid email"],
      index: true,
    },

    phoneNumber: {
      type: String,
      required: false,
      trim: true,
      match: [/^\d{10,15}$/, "Please enter a valid phone number (10–15 digits)"],
    },

    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false, //  IMPORTANT: hide password by default
    },

    profilePicture: {
      type: String,
      default: null,
    },

    // ADD THIS (important for deleting from Cloudinary)
    profilePicturePublicId: {
      type: String,
      default: null,
    },

    // Used for invalidating tokens (logout all devices)
    tokenVersion: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);


//  Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);

  next();
});


//  Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};


export default mongoose.model("User", userSchema);