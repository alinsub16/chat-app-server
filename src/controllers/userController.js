import User from "../models/User.js"; 

// ============================
// View User Profile
// ===========

export const getUserProfile = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const isOwner = req.user._id.toString() === id;

    // Base public data (safe for everyone)
    const response = {
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      middleName: user.middleName,
      profilePicture: user.profilePicture,
      email: user.email,
      phoneNumber: user.phoneNumber
    };

    // Only include sensitive data if owner
    // if (isOwner) {
    //   response.email = user.email;
    //   response.phoneNumber = user.phoneNumber;
    // }

    res.json(response);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};