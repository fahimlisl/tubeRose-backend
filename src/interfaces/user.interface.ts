import { Document, Types } from "mongoose"


export interface IUser extends Document{
    _id:Types.ObjectId;
    name:string;
    password:string;
    email:string;
    phoneNumber:number;
    refreshToken:string;
    createdAt: Date;
    updatedAt: Date;
}