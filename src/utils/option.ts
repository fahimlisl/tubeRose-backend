// For development: allow both secure and non-secure
// For production: MUST be secure (HTTPS only)
const isProduction = process.env.NODE_ENV === "production";

// export const option = {
//   httpOnly: true,
//   secure: isProduction, // Only enforce Secure flag in production (HTTPS)
//   sameSite: isProduction ? ("none" as const) : ("lax" as const), // Use 'lax' in dev, 'none' in prod
//   path: "/",
//   maxAge: 24 * 60 * 60 * 1000, // 24 hours
// };

const base = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? ("none" as const) : ("lax" as const),
  path: "/",
};

export const accessTokenOption = {
  ...base,
  maxAge: 15 * 60 * 1000, // 15 min — matches ACCESS_TOKEN_EXPIRY
  //  maxAge: 10 * 1000
};

export const refreshTokenOption = {
  ...base,
  maxAge: 14 * 24 * 60 * 60 * 1000, // 14 days — matches REFRESH_TOKEN_EXPIRY
  //  maxAge: 2 * 60 * 1000,
};
