import { Document, Types } from "mongoose"


export interface IUser extends Document{
    _id:Types.ObjectId;
    name:string;
    password:string;
    email:string;
    phoneNumber:number;
    refreshToken?:string;
    ownReferralCode:string;
    usedReferralCode?:string | null;
    wallet:IWallet[];
    createdAt: Date;
    updatedAt: Date;
    addresses:IAddress[];
    cart:ICart[];
    resetPasswordToken:string;
}

export interface IWallet {
    source_id:Types.ObjectId | null; // for only storing object id of user who has used the referral coupon , will be null for other things or we can also save order object id if we want 
    amount:number;
    source:string;
    type:"credit" | "debit";
    description?:string;
    // createdAt: Date;
    // updatedAt: Date;
}

export interface IAddress {
    fullName:string;
    phone:string;
    houseNo?:string;
    addressLine1:string;
    addressLine2?:string;
    city:string;
    state:string;
    pincode:string;
    isDefault: boolean;
}

export interface ICart {
    product:Types.ObjectId;
    quantity:number;
    sizeLabel:string;
}