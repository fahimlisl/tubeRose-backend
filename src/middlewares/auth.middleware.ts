import { NextFunction, Request, Response } from "express";
import Jwt  from "jsonwebtoken";
import { ApiError } from "../utils/ApiError";
import { Admin } from "../models/admin.model";

const roleModel:Record<string,string> = {
    "admin":"Admin",
    "user":"User"
}

export const verifyJWT = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let token;

    if (req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }
    if (!token && req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized access - No token provided",
      });
    }

    const decode = Jwt.verify(token,process.env.ACCESS_TOKEN_SECRET as string) as JwtPayload;
    if(!decode) throw new ApiError(400,"Unauthorized access - token didn't matched!")
    const Model = roleModel[decode.role];
    const user = await Admin.findById(decode._id);
    if(!user) throw new ApiError(400,"user wasn't able to found!");
    req.user = user;
    req.role = decode.role;
    next();
  } catch (error) {
    console.log(`got error in auth middleware! error : ${error}`);
    return res
    .status(401)
    .json({
        success:false,
        message:"Unauthorized access"
    })
  }
};
