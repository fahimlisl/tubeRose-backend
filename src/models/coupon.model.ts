import { model, Schema } from "mongoose";
import { ICoupon } from "../interfaces/coupon.interface.ts";

const couponSchema = new Schema<ICoupon>(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    typeOfCoupon: {
      type: String,
      enum: ["flat", "percentage"],
      required: true,
    },
    value: {
      type: Number,
      required: true,
      min: [1, "Discount value must be at least 1"],
    },
    minCartAmount: {
      type: Number,
      default: 0,
    },
    maxDiscount: {
      type: Number,
    },
    expiryDate: {
      type: Date,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true, 
    },
    category: {
      type: String,
      enum: ["CREAM", "ALL", "FACE WASH", "TONERS", "CLEANSERS", "SUNSCREENS"],
      required: true,
    },
    isForFirstTimeUser: {
      type: Boolean,
      required: true,
      default: false,
    },
    usedCount: {
      type: Number,
      default: 0,
    },
    usageLimit: {
      type: Number, 
    },
    perUserLimit: {
      type: Number,
      default: 1,   
    }
  },
  { timestamps: true }
);

export const Coupon = model<ICoupon>("Coupon", couponSchema);