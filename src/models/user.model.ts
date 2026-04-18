import { Schema , model } from "mongoose";
import bcryptjs from "bcryptjs"
import { IUser } from "../interfaces/user.interface";

const userSchema = new Schema<IUser>({
    name:{
        type:String,
        required:true
    },
    password:{
        type:String,
        required:true
    },
    email:{
        type:String,
        // required:true // will not make it mandetory as of now , bt surely will need to   
    },
    phoneNumber:{
        type:Number,
        required:true
    },
    refreshToken:{
        type:String
    }
},{
    timestamps:true
});

userSchema.pre("save",async function () {
    if(!this.isModified("password")) return;
    this.password = await bcryptjs.hash(this.password,10)
})

export const User = model<IUser>("User",userSchema);