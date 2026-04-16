import { asyncHandler } from "../utils/AsyncHandler.ts";
import { ApiResponse } from "../utils/ApiResponse.ts";
import { ApiError } from "../utils/ApiError.ts";
import { Request,Response } from "express";
import { Admin } from "../models/admin.model";


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

    if(!email || !phoneNumber ) {
        throw new ApiError(400,"email or phone number required")
    }

    if(!password) throw new ApiError(400,"password must required!");

    const admin = await Admin.findOne({
        $or:[
            {email},{phoneNumber}
        ]
    })

    if(!admin) throw new ApiError(400,"admin is not registered!");

    // const checkPassword = await admin.comparePassword(password);
})


export { registerAdmin }