import { model, Schema } from "mongoose";
import { IShipping } from "../interfaces/shipping.settings.interface.ts";
 
const shippingSchema = new Schema<IShipping>(
  {
    freeShippingEnabled: {
      type:    Boolean,
      default: false,
    },
    freeShippingThreshold: {
      type:    Number,
      default: 499,
    },
    defaultShippingCost: {
      type:    Number,
      default: 99,
    },
    isActive: {
      type:    Boolean,
      default: true,
    },
    updatedBy: {
      type: String,
    },
  },
  { timestamps: true }
);
 
export const Shipping = model<IShipping>("Shipping", shippingSchema);