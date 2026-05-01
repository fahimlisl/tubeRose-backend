import { asyncHandler } from "../utils/AsyncHandler.ts";
import { ApiResponse } from "../utils/ApiResponse.ts";
import { ApiError } from "../utils/ApiError.ts";
import { Request,Response } from "express";
import { Admin } from "../models/admin.model.ts";
import { comparePassword, generateToken } from "../utils/auth.util.ts";
import jwt from "jsonwebtoken"
import { accessTokenOption, refreshTokenOption } from "../utils/option.ts";


const accessSecret = process.env.ACCESS_TOKEN_SECRET as string;
const accessExpriy = process.env.ACCESS_TOKEN_EXPIRY as string
const refreshSecret = process.env.REFRESH_TOKEN_SECRET as string;
const refreshExpriy = process.env.REFRESH_TOKEN_EXPIRY as string

const registerAdmin = asyncHandler(async(req:Request,res:Response) => {
    const { name , email , phoneNumber , password } = req.body;
    if([name,email,phoneNumber,password].some((t) => !t && t !== 0)){
        throw new ApiError(400,"each field is required!");
    }

    const check = await Admin.findOne({
        $or:[
            {email},{phoneNumber}
        ]
    });

    if(check) throw new ApiError(400,"phone number or email is already registered!");

    const admin = await Admin.create({
        name,
        email,
        phoneNumber,
        password
    });

    if(!admin) throw new ApiError(500,"internal server error ! faield to register Admin");

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            admin,
            "admin has been registered successfully"
        )
    )
});

const adminLogin = asyncHandler(async(req:Request,res:Response) => {
    const { email,phoneNumber,password } = req.body;

    if(!(email || phoneNumber) ) {
        throw new ApiError(400,"email or phone number required")
    }

    if(!password) throw new ApiError(400,"password must required!");

    const admin = await Admin.findOne({
        $or:[
            {email},{phoneNumber}
        ]
    })

    if(!admin) throw new ApiError(400,"admin is not registered!");

    const checkPassword = await comparePassword(password,admin.password);
    if(!checkPassword) throw new ApiError(400,"incorrect password!");

    const accessToken = generateToken({_id:admin._id,role:"admin"},accessSecret,accessExpriy);
    const refreshToken = generateToken({_id:admin._id,role:"admin"},refreshSecret,refreshExpriy);
    if(!accessToken) throw new ApiError(400,"failed to generate access token");
    if(!refreshToken) throw new ApiError(400,"failed to generate refresh token");

    admin.refreshToken = refreshToken;
    await admin.save({validateBeforeSave:false});

    return res
    .status(200)
    .cookie("admin_accessToken",accessToken,accessTokenOption)
    .cookie("admin_refreshToken",refreshToken,refreshTokenOption)
    .json(
        new ApiResponse(
            200,
            {
    accessToken,
    refreshToken,
    admin: {      
      _id: admin._id,
      role: "admin",
      email: admin.email,
    }
  },
            "successfully logged in"
        )
    )
});

const adminLogout = asyncHandler(async(req:Request,res:Response) => {
    const userId = req.user?._id;
    const admin = await Admin.findById(userId);
    if(!admin) throw new ApiError(400,"unauthorized!");

     await Admin.findByIdAndUpdate(userId, {
        $unset: { refreshToken: 1 }  // remove from DB
    });
    return res
    .status(200)
    .clearCookie("admin_refreshToken",accessTokenOption)
    .clearCookie("admin_accessToken",refreshTokenOption)
    .json(
        new ApiResponse(
            200,
            {},
            "logged out successfully!"
        )
    );
});

const refreshAccessTokenAdmin = asyncHandler(async (req: Request, res: Response) => {
    const incomingRefreshToken = req.cookies?.admin_refreshToken;

    if (!incomingRefreshToken) throw new ApiError(401, "Unauthorized request");

    const decoded = jwt.verify(incomingRefreshToken, refreshSecret) as any;

    const admin = await Admin.findById(decoded?._id);
    if (!admin) throw new ApiError(401, "Invalid refresh token");
    if (admin.refreshToken !== incomingRefreshToken)
        throw new ApiError(401, "Refresh token is expired or used");

    const newAccessToken = generateToken(
        { _id: admin._id, role: "admin" },
        accessSecret,
        accessExpriy
    );

    const newRefreshToken = generateToken(
        { _id: admin._id, role: "admin" },
        refreshSecret,
        refreshExpriy
    );

    admin.refreshToken = newRefreshToken;
    await admin.save({ validateBeforeSave: false });

    return res
        .status(200)
        .cookie("admin_accessToken", newAccessToken, accessTokenOption)
        .cookie("admin_refreshToken", newRefreshToken, refreshTokenOption) 
        .json(new ApiResponse(200, {
            accessToken: newAccessToken,
            admin: {
                _id: admin._id,
                role: "admin",
                email: admin.email,
            }
        }, "Access token refreshed"));
});


export { registerAdmin ,adminLogin , adminLogout ,refreshAccessTokenAdmin}