const successMessages = {
  USER_REGISTERED_SUCCESSFULLY: 'User registered successfully',
  LOGIN_SUCCESSFUL: 'Login successful',
  PASSWORD_CREATED_SUCCESSFUL: 'Password created successful',
  TOKENS_REFRESHED: 'Tokens refreshed successfully',
  LOGOUT_SUCCESSFUL: 'Logout successful',
};

const errorMessages = {
  PERMISSION_DENIED: 'Permission Denied',
  RESET_TOKEN_INVALID: 'Reset token is invalid or has expired.',
  FAILED_TO_SEND_RESET_LINK: 'Failed to send reset link',
  RESET_PASSWORD_FAILED: 'Reset password failed',
  TOKEN_EXPIRED: 'Token is invalid or has expired',
  NO_CHANGES: 'No changes detected',
  CREATE_UNSUCCESSFUL: 'Create unsuccessful',
  UPDATE_UNSUCCESSFUL: 'Update unsuccessful',
  DELETE_UNSUCCESSFUL: 'Delete unsuccessful',
  INVALID_CREDENTIALS: 'Invalid credentials',
  NOT_VERIFIED: 'User not verified ',
  INACTIVE_ACCOUNT: 'This account is currently inactive.',
  ACCESS_DENIED: 'Access denied',
  EMAIL_ALREADY_EXISTS: 'Email already exists',
  PHONE_NUMBER_ALREADY_EXISTS: 'Phone number already exists',
  USER_EMAIL_EXISTS: 'User with this email already exists',
  USER_CREATION_FAILED: 'An unexpected error occurred during user creation.',
};

export const emailSubject = {
  EMAIL_VERIFICATION: 'Welcome to Epos – Please Verify Your Email Address',
};

export const emailTemplate = {
  EMAIL_VERIFICATION: 'email-verification',
};

export { successMessages, errorMessages };
