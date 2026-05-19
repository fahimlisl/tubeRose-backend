import { model, Schema } from "mongoose";
import { IReview } from "../interfaces/review.interface.ts";


const reveiwSchema = new Schema<IReview>({
    product:{
        type:Schema.ObjectId,
        ref:"Product",
        required:true
    },
    user:{
        type:Schema.ObjectId,
        ref:"User",
        required:true
    },
    rating:{
        type:Number,
        default:1,
        required:true
    },
    title:{
        type:String,
        required:true // will be some defautl templates from frontend or backend , lets think what to do ! 
    },
    body:{
        type:String,
        required:true
    },
    isVerifiedPurchase:{
        type:Boolean,
        default:false // will depenend on weather the user has purchased the product or not
    },
    // don't need it as of now
    // isApproved:{
    //     type:Boolean,
    //     default:false
    // },
    // images are optional 
    images:[
       {
        url:{
            type:String
        },
        public_id:{
            type:String
        }
       },
    ]
},{timestamps:true})


export const Review = model<IReview>("Review",reveiwSchema)

