import { Schema, model } from "mongoose";
import { IOrder } from "../interfaces/order.interface.ts";

const orderSchema = new Schema<IOrder>({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true },
  items: [
    {
      product: { type: Schema.Types.ObjectId, ref: "Product" },
      name: String,
      price: Number,       
      quantity: Number,
      image: String,
    }
  ],
  shippingAddress: {
    fullName: String,
    phone: String,
    houseNo:String,
    addressLine1: String,
    addressLine2: String,
    city: String,
    state: String,
    pincode: String,
  },
  paymentMethod: { type: String, enum: ["razorpay", "cod"] },
  paymentStatus: { type: String, enum: ["pending", "paid", "failed"], default: "pending" },
  orderStatus: { type: String, enum: ["placed", "processing", "shipped", "delivered", "cancelled"], default: "placed" },
  razorpayOrderId: String,
  razorpayPaymentId: String,
  baseAmount:Number,
  totalAmount: Number,
  discount:{
    code:String,
    amount:String
  }
}, { timestamps: true });


export const Order = model<IOrder>("Order",orderSchema)