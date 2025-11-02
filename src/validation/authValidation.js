import Joi from "joi";

const nameRegex = /^[A-Za-z\s'-]+$/;
const numberRegex = /^[0-9]{10,11}$/
// User registration validation
export const registerSchema = Joi.object({
  firstName: Joi.string().trim().min(2).max(30).pattern(nameRegex).required().messages({
    "string.empty": "First name is required",
    "string.min": "First name must be at least 2 characters",
    "string.max": "First name must not exceed 30 characters",
    "string.pattern.base": "First name can only contain letters, spaces, hyphens, and apostrophes",
  }),
  lastName: Joi.string().trim().min(2).max(30).pattern(nameRegex).required().messages({
    "string.empty": "Last name is required",
    "string.min": "Last name must be at least 2 characters",
    "string.max": "Last name must not exceed 30 characters",
    "string.pattern.base": "Last name can only contain letters, spaces, hyphens, and apostrophes",
  }),
  middleName: Joi.string().trim().min(2).max(30).pattern(nameRegex).required().messages({
    "string.empty": "Middle name is required",
    "string.min": "Last name must be at least 2 characters",
    "string.max": "Last name must not exceed 30 characters",
    "string.pattern.base": "Middle name can only contain letters, spaces, hyphens, and apostrophes",
  }),
  email: Joi.string().email().required().messages({
    "string.email": "Please provide a valid email",
    "any.required": "Email is required",
  }),
  phoneNumber: Joi.string()
    .pattern(numberRegex)
    .messages({
      "string.pattern.base": "Phone number must be 10 to 11 digits",
    }),
  password: Joi.string().min(6).required().messages({
    "string.min": "Password must be at least 6 characters long",
    "any.required": "Password is required",
  }),
 profilePicture: Joi.any().optional(), 
});
export const updateProfileSchema = Joi.object({
  firstName: Joi.string().trim().min(2).max(30).messages({
      "string.base": "First name must be a text",
      "string.min": "First name must be at least 2 characters long",
      "string.max": "First name must not exceed 30 characters",
    }),
  lastName: Joi.string().trim().min(2).max(30).optional().messages({
      "string.base": "Last name must be a text",
      "string.min": "Last name must be at least 2 characters long",
      "string.max": "Last name must not exceed 30 characters",
    }),
   middleName: Joi.string().trim().min(2).max(30).optional().messages({
      "string.base": "Last name must be a text",
      "string.min": "Last name must be at least 2 characters long",
      "string.max": "Last name must not exceed 30 characters",
    }),
  email: Joi.string().email().optional().messages({
      "string.email": "Please provide a valid email address",
    }),
  phoneNumber: Joi.string() .pattern(/^[0-9]{10,11}$/) .optional() .messages({
      "string.pattern.base": "Phone number must be 10 to 11 digits",
    }),
  currentPassword: Joi.string().optional(),
  password: Joi.string().min(6).optional().messages({
      "string.base": "Password must be a text",
      "string.min": "Password must be at least 6 characters long",
    }),
})
.or("firstName", "lastName", "email", "phoneNumber", "password")
.messages({
  "object.missing": "At least one field must be provided to update your profile",
});