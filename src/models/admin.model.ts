import { model, Schema } from "mongoose";
import bcryptjs from "bcryptjs";
import { IAdmin } from "../interfaces/admin.interface";

const adminSchema = new Schema<IAdmin>(
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
      type: Number,
      required: true,
    },
    password: {
      type: String,
      required: true,
    },
    refreshToken:{
      type:String
    }
  },
  {
    timestamps: true,
  }
);

adminSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcryptjs.hash(this.password, 10);
});

export const Admin = model<IAdmin>("Admin",adminSchema)