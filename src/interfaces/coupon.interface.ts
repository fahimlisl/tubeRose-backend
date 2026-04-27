import { Document, Types } from "mongoose";

export interface ICoupon extends Document {
  code: string;
  typeOfCoupon: "flat" | "percentage";   
  value: number;
  minCartAmount: number;
  maxDiscount?: number;
  expiryDate?: Date;
  isActive: boolean;
  category: "CREAM" | "ALL" | "FACE WASH" | "TONERS" | "CLEANSERS" | "SUNSCREENS";
  isForFirstTimeUser: boolean;
  usedCount: number;
  usageLimit?: number;
  perUserLimit?: number | null;
}