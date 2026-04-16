import mongoose from "mongoose";
import bcryptjs from "bcryptjs";
import jwt, { SignOptions } from "jsonwebtoken";
const adminSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    phoneNumber: {
      type: String,
      required: true,
    },
    password: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

adminSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcryptjs.hash(this.password, 10);
});

adminSchema.methods.comparePassword = async function (password:string) {
  return await bcryptjs.compare(this.password,password);
}

adminSchema.methods.generateAccessToken = async function () {
  const secret = process.env.ACCESS_TOKEN_SECRET as string;
  const expiry = process.env.ACCESS_TOKEN_EXPIRY as SignOptions["expiresIn"];
  return jwt.sign(
    {
      _id: this._id,
      role:"admin"
    },
    secret,
    {
      expiresIn: expiry,
    }
  );
};

adminSchema.methods.generateRefreshToken = async function () {
    const secret = process.env.REFRESH_TOKEN_SECRET as string;
    const expiry = process.env.REFRESH_TOKEN_EXPIRY as SignOptions["expiresIn"];
    return jwt.sign(
        {
            _id:this._id,
            role:"admin"
        },
        secret,
        {
            expiresIn:expiry
        }
    )
}

export const Admin = mongoose.model("Admin", adminSchema);
