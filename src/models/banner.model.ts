import { model, Schema } from "mongoose";
import { IBanner } from "../interfaces/banner.interface";


const bannerSchema = new Schema<IBanner>(
    {
        message:{
            type:String,
            required:true
        },
        priority:{
            type:Number
        },
        bgColor:{
            type:String,
            default:"black"
        },
        startDate:{
            type:Date,
            default:Date.now()
        },
        endDate:{
            type:Date,
            // by default it won't end , unless its not acitve or set a date to end manually
        },
        isActive: {
            type: Boolean,
            default: true
        }
    },
    {
        timestamps:true
    }
)


export const Banner = model<IBanner>("Banner",bannerSchema)