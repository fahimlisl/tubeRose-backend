// controllers/settings.controller.ts
import { Request, Response } from "express";
import { asyncHandler } from "../utils/AsyncHandler.ts";
import { ApiError } from "../utils/ApiError.ts";
import { ApiResponse } from "../utils/ApiResponse.ts";
import { WalletSettings } from "../models/wallet.settings.model";

// always one doc — upsert pattern
const getOrCreateSettings = async () => {
  let settings = await WalletSettings.findOne();
  if (!settings) settings = await WalletSettings.create({});
  return settings;
};

export const getSettings = asyncHandler(async (req: Request, res: Response) => {
  const settings = await getOrCreateSettings();
  return res.status(200).json(new ApiResponse(200, settings, "settings fetched."));
});

export const updateSettings = asyncHandler(async (req: Request, res: Response) => {
  const allowed = [
    "walletCashbackEnabled", "walletCashbackPercent",
    "walletSpendingEnabled", "walletSpendingMaxPercent", "walletSpendingMaxFixedCap",
    "referralBonusEnabled",  "referralBonusAmount",
  ];

  const updates: Record<string, any> = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }

  if (!Object.keys(updates).length) throw new ApiError(400, "no valid fields to update.");

  const settings = await WalletSettings.findOneAndUpdate(
    {},
    { $set: updates },
    { new: true, upsert: true }
  );

  return res.status(200).json(new ApiResponse(200, settings, "settings updated."));
});