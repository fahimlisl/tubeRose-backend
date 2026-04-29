import { ApiError } from "../utils/ApiError.ts";
import { asyncHandler } from "../utils/AsyncHandler.ts";
import { ApiResponse } from "../utils/ApiResponse.ts";
import { Request, Response } from "express";
import { Model } from "mongoose";
import { comparePassword } from "../utils/auth.util.ts";

export const resetPassword = (UserModel: Model<any>) =>
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?._id;
    if (!userId) throw new ApiError(401, "User must be logged in.");

    const { oldPassword, newPassword, confirmNewPassword } = req.body;
    if (!oldPassword || !newPassword || !confirmNewPassword) {
      throw new ApiError(400, "All fields are required.");
    }
    if (newPassword.length < 8) {
      throw new ApiError(400, "New password must be at least 8 characters.");
    }
    if (newPassword !== confirmNewPassword) {
      throw new ApiError(400, "New password and confirm password must match.");
    }
    if (oldPassword === newPassword) {
      throw new ApiError(400, "New password cannot be the same as old password.");
    }

    const user = await UserModel.findById(userId);
    if (!user) throw new ApiError(404, "User not found.");
    const isMatch = await comparePassword(oldPassword, user.password);
    if (!isMatch) throw new ApiError(400, "Old password is incorrect.");
    user.password = newPassword;
    await user.save({ validateBeforeSave: false });

    return res
      .status(200)
      .json(new ApiResponse(200, {}, "Password updated successfully."));
  });