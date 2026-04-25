import { Document, Types } from "mongoose";

export interface IOrder extends Document {
    user:Types.ObjectId;
    shippingAddress:{
        fullName:string,
        phone:string,
        houseNo?:string,
        addressLine1:string,
        addressLine2?:string,
        city:string,
        state:string,
        pincode:string
    };
    paymentMethod:string;
    paymentStatus:string;
    orderStatus:string;
    razorpayOrderId?:string;
    razorpayPaymentId?:string;
    totalAmount:number;
    discount:{
        code:string,
        amount:number
    };
    items:{
        product:Types.ObjectId,
        name:string,
        price:number,
        quantity:number,
        image:string, // thinking weather we should store image or, we can directly get it from productId that we have
        sizeLabel:string
    }[],
    baseAmount:number
}