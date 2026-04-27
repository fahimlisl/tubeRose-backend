import { Router } from "express";
import { adminLogin, adminLogout, refreshAccessTokenAdmin, registerAdmin } from "../controllers/admin.controller.ts";
import { verifyJWT } from "../middlewares/auth.middleware.ts";
import { addProduct, editProduct, fetchAllProducts, fetchParticularProduct, removeProduct } from "../controllers/product.controller.ts";
import { upload } from "../middlewares/multer.middleware.ts";
import { isAdmin } from "../middlewares/isAdmin.middleware.ts";
import { createBanner, deleteBanner, getAllBanners, toggleBanner, updateBanner } from "../controllers/banner.controller.ts";
import { addCoupon, applyCoupon, deleteCoupon, editCoupon, getAllCoupons, getCouponById, toggleCoupon } from "../controllers/coupon.controller.ts";


const router = Router();

router.route("/register").post(registerAdmin);
router.route("/login").post(adminLogin)
router.route("/logout").post(verifyJWT,adminLogout)
router.route("/refresh/access-token").post(refreshAccessTokenAdmin)

// product
router.route("/product/add").post(verifyJWT,isAdmin,upload.array("image",3),addProduct)
router.route("/product/edit/:id").patch(verifyJWT,isAdmin,upload.array("image",3),editProduct)
router.route("/product/delete/:id").delete(verifyJWT,isAdmin,removeProduct)
router.route("/product/fetch/all").get(verifyJWT,isAdmin,fetchAllProducts)
router.route("/product/fetch/:id").get(verifyJWT,isAdmin,fetchParticularProduct)


// banner
router.route("/banner/add").post(verifyJWT,isAdmin,createBanner)
router.route("/banner/edit/:id").patch(verifyJWT,isAdmin,updateBanner)
router.route("/banner/toggle/:id").patch(verifyJWT,isAdmin,toggleBanner)
router.route("/banner/fetch/all").get(verifyJWT,isAdmin,getAllBanners)
router.route("/banner/delete/:id").delete(verifyJWT,isAdmin,deleteBanner)


// coupon
router.route("/coupon/add").post(verifyJWT, isAdmin, addCoupon)
router.route("/coupon/all").get(verifyJWT, isAdmin, getAllCoupons)
router.route("/coupon/:id").get(verifyJWT, isAdmin, getCouponById)
router.route("/coupon/edit/:id").patch(verifyJWT, isAdmin, editCoupon)
router.route("/coupon/toggle/:id").patch(verifyJWT, isAdmin, toggleCoupon)
router.route("/coupon/delete/:id").delete(verifyJWT, isAdmin, deleteCoupon)

export default router;