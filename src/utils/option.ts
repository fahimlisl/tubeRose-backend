// For development: allow both secure and non-secure
// For production: MUST be secure (HTTPS only)
const isProduction = process.env.NODE_ENV === "production";

export const option = {
  httpOnly: true,
  secure: isProduction, // Only enforce Secure flag in production (HTTPS)
  sameSite: isProduction ? ("none" as const) : ("lax" as const), // Use 'lax' in dev, 'none' in prod
  path: "/",
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
};
