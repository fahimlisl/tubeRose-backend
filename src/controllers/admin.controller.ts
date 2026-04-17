import { asyncHandler } from "../utils/AsyncHandler.ts";
import { ApiResponse } from "../utils/ApiResponse.ts";
import { ApiError } from "../utils/ApiError.ts";
import { Request,Response } from "express";
import { Admin } from "../models/admin.model";
import { comparePassword, generateToken } from "../utils/auth.util.ts";


const accessSecret = process.env.ACCESS_TOKEN_SECRET as string;
const accessExpriy = process.env.ACCESS_TOKEN_EXPIRY as string
const refreshSecret = process.env.REFRESH_TOKEN_SECRET as string;
const refreshExpriy = process.env.REFRESH_TOKEN_EXPIRY as string

const option: object = {
    httpOnly:true,
    secure:true
}

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
    console.log(accessExpriy,accessSecret,refreshExpriy,refreshSecret)
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
    .cookie("accessToken",accessToken,option)
    .cookie("refreshToken",refreshToken,option)
    .json(
        new ApiResponse(
            200,
            {accessToken,refreshToken},
            "successfully logged in"
        )
    )
});

const adminLogout = asyncHandler(async(req:Request,res:Response) => {
    const userId = req.user?._id;
    const admin = await Admin.findById(userId);
    if(!admin) throw new ApiError(400,"unauthorized!");

    admin.refreshToken = "";
    admin.save({validateBeforeSave:false});
    return res
    .status(200)
    .clearCookie("refreshToken",option)
    .clearCookie("accessToken",option)
    .json(
        new ApiResponse(
            200,
            {},
            "logged out successfully!"
        )
    );
});


export { registerAdmin ,adminLogin , adminLogout }