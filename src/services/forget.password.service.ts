import { Model } from "mongoose";
import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { ApiError } from "../utils/ApiError.ts";
import { asyncHandler } from "../utils/AsyncHandler.ts";
import { ApiResponse } from "../utils/ApiResponse.ts";
import { accessTokenOption } from "../utils/option.ts";


export const generateResetPasswordToken = (UserModel: Model<any>) =>
  asyncHandler(async (req: Request, res: Response) => {
    const { email, phoneNumber } = req.body;

    if (!(email || phoneNumber))
      throw new ApiError(400, "Email or phone number is required.");

    const user = await UserModel.findOne({
      $or: [{ email }, { phoneNumber }],
    });
    if (!user) throw new ApiError(404, "No account found with this email or phone number.");

    const otp = Math.floor(100000 + Math.random() * 900000); // always 6 digits

    const token = jwt.sign(
      { OTP: otp, _id: user._id },
      process.env.RESET_PASSWORD_TOKEN_SECRET!,
      { expiresIn: process.env.RESET_PASSWORD_TOKEN_EXPIRY ?? "10m" }
    );

    user.resetPasswordToken = token;
    await user.save({ validateBeforeSave: false });

    try {
      const response = await fetch(process.env.N8N_WEBHOOK_SMS_URL!, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type:        "forget_password", // ← your n8n workflow trigger field
          phoneNumber: phoneNumber ?? user.phoneNumber,
          otp,
        }),
      });

      if (!response.ok) {
        throw new Error(`n8n responded with status ${response.status}`);
      }
    } catch (error) {
      user.resetPasswordToken = null;
      await user.save({ validateBeforeSave: false });
      throw new ApiError(500, "Failed to send OTP. Please try again.");
    }

    return res
      .status(200)
      .cookie("resetPasswordToken", token, {
        httpOnly: true,
        secure:   process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        maxAge:   10 * 60 * 1000, // 10 min — matches token expiry
        path:     "/",
      })
      .json(new ApiResponse(200, {}, "OTP sent successfully."));
  });

export const validateOTPandResetPassword = (UserModel: Model<any>) =>
  asyncHandler(async (req: Request, res: Response) => {
    const { otp, newPassword, confirmNewPassword } = req.body;

    if (!otp || !newPassword || !confirmNewPassword)
      throw new ApiError(400, "All fields are required.");

    if (String(otp).length !== 6)
      throw new ApiError(400, "OTP must be exactly 6 digits.");

    if (newPassword !== confirmNewPassword)
      throw new ApiError(400, "New password and confirm password must match.");

    if (newPassword.length < 8)
      throw new ApiError(400, "Password must be at least 8 characters.");

    // ── read token from cookie or header ──
    const token =
      req.cookies?.resetPasswordToken ??
      req.headers.authorization?.replace("Bearer ", "");

    if (!token) throw new ApiError(401, "Reset session expired. Please request a new OTP.");

    // ── verify token ──
    let decoded: { OTP: number; _id: string };
    try {
      decoded = jwt.verify(token, process.env.RESET_PASSWORD_TOKEN_SECRET!) as any;
    } catch(err) {
      res.clearCookie("resetPasswordToken");
      throw new ApiError(401, "OTP has expired. Please request a new one.");
    }

    // ── match OTP ──
    if (decoded.OTP !== Number(otp))
      throw new ApiError(400, "Incorrect OTP. Please try again.");

    // ── fetch user ──
    const user = await UserModel.findById(decoded._id);
    if (!user) throw new ApiError(404, "User not found.");

    // ── make sure token matches what's stored (prevents token reuse) ──
    if (user.resetPasswordToken !== token) {
      throw new ApiError(401, "OTP already used or expired. Please request a new one.");
    }

    // ── update password — pre-save hook will hash it ──
    user.password           = newPassword;
    user.resetPasswordToken = null; // invalidate immediately after use
    await user.save();

    return res
      .status(200)
      .clearCookie("resetPasswordToken")
      .json(new ApiResponse(200, {}, "Password reset successfully."));
  });