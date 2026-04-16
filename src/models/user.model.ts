import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    name:{
        type:String,
        required:true
    },
    password:{
        type:String,
        required:function () {
            return this.provider === "local";
        }
    },
    email:{
        type:String,
        required:true
    },
    provider: {
        type:String,
        enum:["local","google"]
    },
    googleId:{
        type:String
    },
    phoneNumber:{
        type:Number
        // not explicitly required as of now , bt will be needing to 
    }
},{
    timestamps:true
});


export const User = mongoose.model("User",userSchema);