import { Schema , model } from "mongoose";
import bcryptjs from "bcryptjs"
import { IAddress, ICart, IUser, IWallet } from "../interfaces/user.interface";


const walletSchema = new Schema<IWallet>({
    source_id:{
        type:Schema.Types.ObjectId,
        default:null
    },
    source:{
        type:String,
        required:true
    },
    amount:{
        type:Number,
        min:0
    },
    type:{
         type: String,
        required: true,
        enum: ["credit", "debit"],
    },
    description:{
        type:String
    }

},
{
    timestamps:true,
})

const addressSchema = new Schema<IAddress>({
    fullName: {
        type: String,
        required:true

    },
    phone: {
        type: String,
        required:true

    },
    houseNo:{
        type: String

    },
    addressLine1: {
        type: String,
        required:true

    },
    addressLine2: {
        type: String

    },
    city: {
        type: String,
        required:true
    },
    state: {
        type: String,
        required:true

    },
    pincode: {
        type: String,
        required:true

    },
    isDefault: {
        type: Boolean,
        default:false
    },
})

const cartSchema = new Schema<ICart>({
    product:{
        type: Schema.Types.ObjectId,
        ref:"Product"
    },
    quantity:{type: Number , default: 1},
    sizeLabel: {
        type: String,
        required: true, 
  },
})


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
        unique:true
        // required:true // will not make it mandetory as of now , bt surely will need to   
    },
    phoneNumber:{
        type:Number,
        required:true
    },
    refreshToken:{
        type:String
    },
    ownReferralCode: {
        type: String,
        unique: true,
        required: true,
    },
    usedReferralCode: {
        type: String,
        default: null,
    },
    wallet:{
        type:[walletSchema],
        default:[]
    },
    addresses:{
        type:[addressSchema],
    },
    cart:{
        type:[cartSchema],
        default:[]
    },
    resetPasswordToken:{
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