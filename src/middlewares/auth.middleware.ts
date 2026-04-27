import { NextFunction, Request, Response } from "express";
import Jwt  from "jsonwebtoken";
import { ApiError } from "../utils/ApiError.ts";
import { Admin } from "../models/admin.model.ts";
import { User } from "../models/user.model.ts";
import { JwtPayload } from "../interfaces/global.interface.ts";

const roleModel = {
    admin:Admin,
    user:User
}

export const verifyJWT = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let token;

    if (req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      const isAdminRoute = req.originalUrl.includes("/admin");
      
      if (isAdminRoute && req.cookies?.admin_accessToken) {
        token = req.cookies.admin_accessToken;
      } else if (!isAdminRoute && req.cookies?.accessToken) {
        token = req.cookies.accessToken;
      }
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized access - No token provided",
      });
    }

    const decode = Jwt.verify(
      token,
      process.env.ACCESS_TOKEN_SECRET as string
    ) as JwtPayload;

    const Model = roleModel[decode.role];
    const user = await (Model as any).findById(decode._id);
    if (!user) throw new ApiError(400, "User not found!");

    req.user = user;
    req.role = decode.role;
    next();
  } catch (error) {
    console.log(`got error in auth middleware! error : ${error}`);
    return res.status(401).json({
      success: false,
      message: "Unauthorized access",
    });
  }
};