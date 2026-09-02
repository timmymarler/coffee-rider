const AUTH_CONTINUE_BASE_URL = "https://coffee-rider-bea88.firebaseapp.com";

function createAuthNonce() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function buildContinueUrl(pathname) {
  const safePath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const nonce = createAuthNonce();
  return `${AUTH_CONTINUE_BASE_URL}${safePath}?nonce=${nonce}`;
}

export function buildEmailVerificationActionCodeSettings() {
  return {
    url: buildContinueUrl("/auth/verify"),
    handleCodeInApp: false,
  };
}

export function buildPasswordResetActionCodeSettings() {
  return {
    url: buildContinueUrl("/auth/reset-password"),
    handleCodeInApp: false,
  };
}
