import { Router } from "express";
import { registerUser, checkPhoneNumber, sendOTP, verifyOTP, applyReferralCode } from "../controllers/user.controller";
import { verifyJWT } from "../middlewares/auth.middleware";


const router = Router();

router.route("/auth/user/signup").post(registerUser)
router.route("/auth/check/phone-number").post(checkPhoneNumber)
router.route("/auth/otp/send").post(sendOTP)
router.route("/auth/otp/verify").post(verifyOTP)
router.route("/apply/coupon/referral").post(verifyJWT,applyReferralCode)

export default router;