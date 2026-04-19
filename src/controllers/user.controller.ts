import { Request, Response } from "express";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { User } from "../models/user.model.ts";
import { ApiError } from "../utils/ApiError.ts";
import { ApiResponse } from "../utils/ApiResponse.ts";
import { asyncHandler } from "../utils/AsyncHandler.ts";
import { comparePassword, generateToken } from "../utils/auth.util.ts";
import { option } from "../utils/option.ts";

const sendOtpSecret = process.env.SEND_OTP_TOKEN_SECRET as string;
const sendOtpExpiry = process.env.SEND_OTP_TOKEN_EXPIRY as string;

const phoneNumberSecret = process.env.PHONE_NUMBER_STATE_SECRET as string;
const phoneNumberExpiry = process.env.PHONE_NUMBER_STATE_EXPIRY as string;


const accessSecret = process.env.ACCESS_TOKEN_SECRET as string;
const accessExpriy = process.env.ACCESS_TOKEN_EXPIRY as string
const refreshSecret = process.env.REFRESH_TOKEN_SECRET as string;
const refreshExpriy = process.env.REFRESH_TOKEN_EXPIRY as string

// signup logic starts
const checkPhoneNumber = asyncHandler(async (req: Request, res: Response) => {
  const { phoneNumber } = req.body;
  if (!phoneNumber || phoneNumber.toString().length !== 10)
    throw new ApiError(400, "10 digit phone number required!");
  const user = await User.findOne({ phoneNumber });
  if (user)
    throw new ApiError(
      400,
      "phone number is already registerd , try logging in!"
    );
  const phoneNumberToken = generateToken(
    { phoneNumber },
    phoneNumberSecret,
    phoneNumberExpiry
  );
  if (!phoneNumberToken)
    throw new ApiError(
      500,
      "internal server error , wasn't able to save token to local storage!"
    );
  return res
    .status(200)
    .cookie("phoneNumberToken", phoneNumberToken, {
      httpOnly: true,
      secure: true,
      maxAge: 5 * 60 * 1000,
      sameSite: "strict",
    })
    .json(new ApiResponse(200, {}, "phone number does not exist!"));
});

const generateOTP = (): number => {
  return crypto.randomInt(100000, 1000000);
};

const hashOTP = (otp: number): string => {
  return crypto.createHash("sha256").update(String(otp)).digest("hex");
};

const sendOTP = asyncHandler(async (req: Request, res: Response) => {
  const phoneNumberToken = req.cookies?.phoneNumberToken;
  let decoded: PhoneNumberTokenPayload;
  try {
    decoded = jwt.verify(
      phoneNumberToken,
      phoneNumberSecret
    ) as PhoneNumberTokenPayload;
  } catch {
    res.clearCookie("phoneNumberToken");
    throw new ApiError(400, "Session expired. Please start again.");
  }
  const phoneNumber = decoded.phoneNumber;
  if (!phoneNumber)
    throw new ApiError(
      400,
      "phone number wasn't able to found in token! please try again later"
    );
  const otp = generateOTP();
  const otphash = hashOTP(otp);

  const otpToken = generateToken(
    { otphash, phoneNumber },
    sendOtpSecret,
    sendOtpExpiry
  );
  if (!otpToken)
    throw new ApiError(400, "failed to generate token for otp! please retry!");
  try {
    const response = await fetch(`${process.env.N8N_WEBHOOK_SMS_URL}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        phoneNumber,
        otp,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log(data);
  } catch (error) {
    throw new ApiError(400, "fialed to invoke n8n url!");
  }

  return res
    .status(200)
    .clearCookie("phoneNumberToken")
    .cookie("otpToken", otpToken, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      maxAge: 5 * 60 * 1000,
    })
    .json(new ApiResponse(200, {}, "otp has been send successfully!"));
});

const verifyOTP = asyncHandler(async (req: Request, res: Response) => {
  const { otp } = req.body;
  const otpToken = req.cookies?.otpToken;
  
  if (!otpToken) {
      throw new ApiError(
          400,
          "OTP session expired or not found. Please request a new OTP."
        );
    }
    let decodedToken: OTPTokenPayload;
    try {
        decodedToken = jwt.verify(otpToken, sendOtpSecret) as OTPTokenPayload;
  } catch (error) {
    res.clearCookie("otpToken");
    throw new ApiError(400, "OTP has expired. Please request a new one.");
  }
  const submittedHash = hashOTP(Number(otp));

  const submittedBuf = Buffer.from(submittedHash, "hex");
  const storedBuf = Buffer.from(decodedToken.otphash, "hex");

  const isMatch =
    submittedBuf.length === storedBuf.length &&
    crypto.timingSafeEqual(submittedBuf, storedBuf);

  if (!isMatch) {
    throw new ApiError(400, "Invalid OTP. Please try again.");
  }
  const phoneNumber = decodedToken.phoneNumber;

  const phoneNumberToken = generateToken({phoneNumber},phoneNumberSecret,phoneNumberExpiry);
  if(!phoneNumberToken) throw new ApiError(400,"failed to generate phone number token");


  res.clearCookie("otpToken");

  return res
    .cookie("phoneNumberToken",phoneNumberToken,{
        httpOnly:true,
        secure:true,
        sameSite:"strict",
        maxAge:10*60*1000
    })
    .status(200)
    .json(new ApiResponse(200, {}, "OTP verified successfully!"));
});

const registerUser = asyncHandler(async (req: Request, res: Response) => {
  const { name, email, password } = req.body; // will be part of frontend how i receive the phone number from previous step! also need to check wheather its safe or not!
  if(!password || !(password.length < 8 )) throw new ApiError(400,"password of minimum length 8 required.");
  const phoneNumberToken = req.cookies?.phoneNumberToken;
  let decoded: PhoneNumberTokenPayload;
  try {
    decoded = jwt.verify(
      phoneNumberToken,
      phoneNumberSecret
    ) as PhoneNumberTokenPayload;
  } catch {
    res.clearCookie("phoneNumberToken");
    throw new ApiError(400, "Session expired. Please start again.");
  }
  const phoneNumber = Number(decoded.phoneNumber);

  const user = await User.findOne({ email });
  if (user) throw new ApiError(400, "email already registered!");
  const u = await User.create({
    name,
    email,
    password,
    phoneNumber,
  });

  if (!u)
    throw new ApiError(500, "failed to register user! internal server error");

  return res
    .status(200)
    .clearCookie("phoneNumberToken")
    .json(new ApiResponse(200, u, "user registered successfully!"));
});

const loginUser = asyncHandler(async(req,res) => {
    const { email , phoneNumber , password } = req.body;
    if(!(email || phoneNumber)) throw new ApiError(400,"email or phone number required.");
    if(!password) throw new ApiError(400,"password required.");
    const user = await User.findOne({
        $or:[
            {email},{phoneNumber}
        ]
    });
    if(!user) throw new ApiError(400,"user has not registered yet. Kindly register before proceed.");
    const checkPassword = await comparePassword(password,user.password);
    if(!checkPassword) throw new ApiError(400,"incorrect password!");

    const accessToken = generateToken({_id:user._id,role:"user"},accessSecret,accessExpriy);
    const refreshToken = generateToken({_id:user._id,role:"user"},refreshSecret,refreshExpriy);
    if(!accessToken) throw new ApiError(400,"failed to generate access token");
    if(!refreshToken) throw new ApiError(400,"failed to generate refresh token");

    user.refreshToken = refreshToken;
    await user.save({validateBeforeSave:false});

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

const refreshAccessToken = asyncHandler(async(req:Request,res:Response) => {
  const incomingRefreshToken = req.cookies?.refreshToken;
  if(!incomingRefreshToken) throw new ApiError(401,"unauthorized request.");

  const decoded = jwt.verify(incomingRefreshToken,refreshSecret) as JwtPayload;
  const user = await User.findById(decoded._id);
  if(!user) throw new ApiError(401,"invalid refresh token.");
  if(user.refreshToken !== incomingRefreshToken) throw new ApiError(401,"refresh Token is expired or used.");

  const newAccessToken = generateToken({_id:user._id,role:"user"},accessSecret,accessExpriy);
  if(!newAccessToken) throw new ApiError(400,"failed to generate new access token.");
  return res
  .status(200)
  .cookie("accessToken",newAccessToken,option)
  .json(
    new ApiResponse(
      200,
      newAccessToken,
      "access token has been refreshed."
    )
  )
});

const logoutUser = asyncHandler(async(req:Request,res:Response) => {
  const userId = req.user._id;
  if(!userId) throw new ApiError(401,"unauthorized access!");
  const user = await User.findById(userId);
  if(!user) throw new ApiError(400,"user isn't registered , or deleted.");
  user.refreshToken = "";
  await user.save({validateBeforeSave:false})
  return res
  .status(200)
  .clearCookie("refreshToken",option)
  .clearCookie("accessToken",option)
  .json(
    new ApiResponse(
      200,
      {},
      "user logged out successfully"
    )
  )
})


export { checkPhoneNumber , sendOTP , verifyOTP , registerUser, loginUser , refreshAccessToken , logoutUser}