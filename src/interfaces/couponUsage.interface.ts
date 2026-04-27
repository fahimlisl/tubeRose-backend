import { Types , Document } from "mongoose";

export interface  ICouponUsage extends Document {
    coupon:Types.ObjectId;
    user:Types.ObjectId;
    order:Types.ObjectId;
}