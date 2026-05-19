import { Document, Types } from "mongoose";

export interface IReview extends Document {
    product: Types.ObjectId;
    user: Types.ObjectId;
    rating: number;
    title: string;
    body: string;
    isVerifiedPurchase: boolean;
    // isApproved: boolean;
    images:{
        url:string,
        public_id:string
    }[]
}