import { Document , Types } from "mongoose";


export interface IAdmin extends Document {
    _id: Types.ObjectId;
    name:string;
    email:string;
    phoneNumber:number;
    password:string;
    refreshToken:string;
    createdAt: Date;
    updatedAt: Date;
}