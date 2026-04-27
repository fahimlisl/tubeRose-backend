import { model, Schema } from "mongoose";
import { ICouponUsage } from "../interfaces/couponUsage.interface.ts";

const couponUsageSchema = new Schema<ICouponUsage>(
  {
    coupon: { type: Schema.Types.ObjectId, ref: "Coupon", required: true },
    user:   { type: Schema.Types.ObjectId, ref: "User",   required: true },
    order:  { type: Schema.Types.ObjectId, ref: "Order",  required: true },
  },
  { timestamps: true } 
);
couponUsageSchema.index({ coupon: 1, user: 1 });

export const CouponUsage = model<ICouponUsage>("CouponUsage", couponUsageSchema);