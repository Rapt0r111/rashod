export function isSecureSessionCookie(env: NodeJS.ProcessEnv = process.env) {
  return env.NODE_ENV === "production" && env.AUTH_ALLOW_INSECURE_LAN !== "true";
}
