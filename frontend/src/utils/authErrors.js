export const AUTH_REQUIRED_MSG =
  'Sign in to chat, upload documents, and use OWNAI features.';

export class AuthRequiredError extends Error {
  constructor(message = 'Authentication required') {
    super(message);
    this.name = 'AuthRequiredError';
    this.status = 401;
  }
}

export function isAuthRequiredError(error) {
  return error?.name === 'AuthRequiredError'
    || error?.status === 401
    || /authentication required|invalid or expired token/i.test(error?.message || '');
}
