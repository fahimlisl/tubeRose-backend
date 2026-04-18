import { Router } from "express";
import { registerUser, checkPhoneNumber, sendOTP, verifyOTP } from "../controllers/user.controller";


const router = Router();

router.route("/auth/user/signup").post(registerUser)
router.route("/auth/check/phone-number").post(checkPhoneNumber)
router.route("/auth/otp/send").post(sendOTP)
router.route("/auth/otp/verify").post(verifyOTP)

export default router;