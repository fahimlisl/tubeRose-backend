import { asyncHandler } from "../utils/AsyncHandler.ts";
import { ApiResponse } from "../utils/ApiResponse.ts";
import { ApiError } from "../utils/ApiError.ts";
import { Request, Response } from "express";
import { Coupon } from "../models/coupon.model.ts";
import { CouponUsage } from "../models/couponUsage.model.ts";

export const addCoupon = asyncHandler(async (req: Request, res: Response) => {
  const {
    code, typeOfCoupon, value, minCartAmount,
    maxDiscount, expiryDate, isActive, category,
    isForFirstTimeUser, usageLimit, perUserLimit,
  } = req.body;

  if (!code || !typeOfCoupon || !value || !category) {
    throw new ApiError(400, "code, typeOfCoupon, value and category are required.");
  }
  if (typeOfCoupon === "percentage" && value > 100) {
    throw new ApiError(400, "Percentage value cannot exceed 100.");
  }
  if (typeOfCoupon === "percentage" && !maxDiscount) {
    throw new ApiError(400, "maxDiscount is required for percentage coupons.");
  }
  const existing = await Coupon.findOne({ code: code.toUpperCase().trim() });
  if (existing) throw new ApiError(400, "Coupon with this code already exists.");

  const coupon = await Coupon.create({
    code,
    typeOfCoupon,
    value,
    minCartAmount: minCartAmount ?? 0,
    maxDiscount,
    expiryDate,
    isActive: isActive ?? true,
    category,
    isForFirstTimeUser: isForFirstTimeUser ?? false,
    usageLimit,
    perUserLimit: perUserLimit ?? 1,
  });

  return res
    .status(201)
    .json(new ApiResponse(201, coupon, "Coupon created successfully."));
});


export const getAllCoupons = asyncHandler(async (req: Request, res: Response) => {
  const coupons = await Coupon.find().sort({ createdAt: -1 });

  return res
    .status(200)
    .json(new ApiResponse(200, coupons, "Coupons fetched successfully."));
});


export const getCouponById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const coupon = await Coupon.findById(id);
  if (!coupon) throw new ApiError(404, "Coupon not found.");

  return res
    .status(200)
    .json(new ApiResponse(200, coupon, "Coupon fetched successfully."));
});

export const editCoupon = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const updates = req.body;

  delete updates.usedCount;

  if (updates.typeOfCoupon === "percentage" && updates.value > 100) {
    throw new ApiError(400, "Percentage value cannot exceed 100.");
  }

  const coupon = await Coupon.findByIdAndUpdate(
    id,
    { $set: updates },
    { new: true, runValidators: true }
  );
  if (!coupon) throw new ApiError(404, "Coupon not found.");

  return res
    .status(200)
    .json(new ApiResponse(200, coupon, "Coupon updated successfully."));
});

export const toggleCoupon = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const coupon = await Coupon.findById(id);
  if (!coupon) throw new ApiError(404, "Coupon not found.");

  coupon.isActive = !coupon.isActive;
  await coupon.save();

  return res
    .status(200)
    .json(new ApiResponse(200, coupon, `Coupon is now ${coupon.isActive ? "active" : "inactive"}.`));
});


export const deleteCoupon = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const coupon = await Coupon.findByIdAndDelete(id);
  if (!coupon) throw new ApiError(404, "Coupon not found.");

  await CouponUsage.deleteMany({ coupon: id });

  return res
    .status(200)
    .json(new ApiResponse(200, null, "Coupon deleted successfully."));
});

export const applyCoupon = asyncHandler(async (req: Request, res: Response) => {
  const { code, cartAmount, cartCategories } = req.body;
  const userId = req.user._id;

  if (!code || !cartAmount) {
    throw new ApiError(400, "code and cartAmount are required.");
  }

  const coupon = await Coupon.findOne({
    code: code.toUpperCase().trim(),
    isActive: true,
  });
  if (!coupon) throw new ApiError(404, "Invalid or inactive coupon.");

  if (coupon.expiryDate && new Date() > coupon.expiryDate) {
    throw new ApiError(400, "Coupon has expired.");
  }
  if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
    throw new ApiError(400, "Coupon usage limit has been reached.");
  }
  if (cartAmount < coupon.minCartAmount) {
    throw new ApiError(
      400,
      `Minimum cart amount of ₹${coupon.minCartAmount} required for this coupon.`
    );
  }
  if (coupon.category !== "ALL") {
    const hasCategory = cartCategories?.includes(coupon.category);
    if (!hasCategory) {
      throw new ApiError(400, `This coupon is only valid for ${coupon.category} products.`);
    }
  }
  if (coupon.isForFirstTimeUser) {
    const { Order } = await import("../models/order.model.ts");
    const previousOrders = await Order.countDocuments({ user: userId });
    if (previousOrders > 0) {
      throw new ApiError(400, "This coupon is only valid for first-time orders.");
    }
  }

  let discountAmount = 0;
  if (coupon.typeOfCoupon === "flat") {
    discountAmount = coupon.value;
  } else {
    discountAmount = Math.round((cartAmount * coupon.value) / 100);
    if (coupon.maxDiscount) {
      discountAmount = Math.min(discountAmount, coupon.maxDiscount);
    }
  }
  discountAmount = Math.min(discountAmount, cartAmount);

  const finalAmount = cartAmount - discountAmount;
  if (coupon.perUserLimit) {
  const timesUsed = await CouponUsage.countDocuments({
    coupon: coupon._id,
    user:   userId,
  });
  if (timesUsed >= coupon.perUserLimit) {
    throw new ApiError(400, "You have already used this coupon.");
  }
}

  return res.status(200).json(
    new ApiResponse(200, {
      code: coupon.code,
      discountAmount,
      finalAmount,
      typeOfCoupon: coupon.typeOfCoupon,
      message: `You saved ₹${discountAmount}!`,
    }, "Coupon applied successfully.")
  );
});