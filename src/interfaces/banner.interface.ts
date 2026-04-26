import { Document } from "mongoose";
export interface IBanner extends Document {
    message:string;
    isActive:boolean;
    priority:number;
    startDate?: Date;    
    endDate?: Date;
    bgColor?: string;
}