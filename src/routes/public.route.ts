import { Router } from "express";
import { registerUser, checkPhoneNumber, sendOTP, verifyOTP, applyReferralCode } from "../controllers/user.controller";
import { verifyJWT } from "../middlewares/auth.middleware";
import { fetchAllProducts, fetchParticularProduct } from "../controllers/product.controller";
import { checkPincodeServiceability } from "../controllers/shipping.controller";
import { getActiveBanners } from "../controllers/banner.controller";
import { User }  from "../models/user.model.ts";
import { Admin } from "../models/admin.model.ts";
import {
  generateResetPasswordToken,
  validateOTPandResetPassword,
} from "../services/forget.password.service.ts";


const router = Router();

router.route("/auth/user/signup").post(registerUser)
router.route("/auth/check/phone-number").post(checkPhoneNumber)
router.route("/auth/otp/send").post(sendOTP)
router.route("/auth/otp/verify").post(verifyOTP)
router.route("/apply/coupon/referral").post(verifyJWT,applyReferralCode)

// product
router.route("/fetch/product/all").get(fetchAllProducts)
router.route("/fetch/product/:id").get(fetchParticularProduct)

// shipping
router.get("/check/serviceability", checkPincodeServiceability);

// banner
router.route("/banner/fetch/active").get(getActiveBanners)


// user
router.post("/user/forgot-password/send-otp",   generateResetPasswordToken(User));
router.post("/user/forgot-password/verify-otp",  validateOTPandResetPassword(User));

// admin
router.post("/admin/forgot-password/send-otp",  generateResetPasswordToken(Admin));
router.post("/admin/forgot-password/verify-otp", validateOTPandResetPassword(Admin));









export default router;