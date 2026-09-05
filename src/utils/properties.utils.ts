const successMessages = {
  USER_REGISTERED_SUCCESSFULLY:
    "User registered successfully. Please check your email for verification.",
  DEALER_REGISTERED_SUCCESSFULLY: "Dealer registered successfully",
  USER_CREATED_SUCCESSFULLY: "User created successfully",
  LOGIN_SUCCESSFUL: "Login successful",
  PASSWORD_CREATED_SUCCESSFUL: "Password created successful",
  TOKENS_REFRESHED: "Tokens refreshed successfully",
  LOGOUT_SUCCESSFUL: "Logout successful",
  EMAIL_VERIFIED_SUCCESSFULLY: "Email verified successfully",
  FORGOT_PASSWORD_EMAIL_SENT:
    "If an account exists, we sent a reset link",
  RESET_TOKEN_VALID: "Reset token is valid",
  PASSWORD_RESET_SUCCESSFUL: "Password reset successfully",
  USERS_FETCHED_SUCCESSFULLY: "Users fetched successfully",
  USER_FETCHED_SUCCESSFULLY: "User fetched successfully",
  USER_UPDATED_SUCCESSFULLY: "User updated successfully",
  USER_DELETED_SUCCESSFULLY: "User deleted successfully",
};

const errorMessages = {
  PERMISSION_DENIED: "Permission Denied",
  RESET_TOKEN_INVALID: "Reset token is invalid or has expired.",
  FAILED_TO_SEND_RESET_LINK: "Failed to send reset link",
  RESET_PASSWORD_FAILED: "Reset password failed",
  TOKEN_EXPIRED: "Token is invalid or has expired",
  NO_CHANGES: "No changes detected",
  CREATE_UNSUCCESSFUL: "Create unsuccessful",
  UPDATE_UNSUCCESSFUL: "Update unsuccessful",
  DELETE_UNSUCCESSFUL: "Delete unsuccessful",
  INVALID_CREDENTIALS: "Invalid credentials",
  NOT_VERIFIED: "User not verified ",
  INACTIVE_ACCOUNT: "This account is currently inactive.",
  ACCESS_DENIED: "Access denied",
  EMAIL_ALREADY_EXISTS: "Email already exists",
  PHONE_NUMBER_ALREADY_EXISTS: "Phone number already exists",
  USER_EMAIL_EXISTS: "User with this email already exists",
  USER_CREATION_FAILED: "An unexpected error occurred during user creation.",
  DEALER_EMAIL_EXISTS: "Dealer with this email already exists",
  USER_NOT_FOUND: "User not found",
  USER_UPDATE_FAILED: "An unexpected error occurred during user update.",
  USER_DELETE_FAILED: "An unexpected error occurred during user deletion.",
};

export const emailSubject = {
  EMAIL_VERIFICATION: "Welcome to DWMS – Please Verify Your Email Address",
  PASSWORD_RESET: "Reset your DWMS password",
};

export const emailTemplate = {
  EMAIL_VERIFICATION: "email-verification",
  PASSWORD_RESET: "password-reset",
};

export { successMessages, errorMessages };
