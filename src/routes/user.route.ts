import { Router } from "express";
import { addAddress, getProfile, loginUser, logoutUser, refreshAccessToken } from "../controllers/user.controller.ts";
import { verifyJWT } from "../middlewares/auth.middleware.ts";
import { addToCart, clearCart, getCart, mergeCart, removeFromCart, updateCartQuantity } from "../controllers/cart.controller.ts";
import { trackOrderByAwb, trackShipmentByAwb } from "../utils/shiprocket.ts";

const router = Router();

router.route("/auth/login").post(loginUser)
router.route("/auth/logout").post(verifyJWT,logoutUser)
router.route("/refresh/access-token").post(refreshAccessToken)

router.route("/get/profile").get(verifyJWT,getProfile)
router.route("/address/add").post(verifyJWT,addAddress)

// cart 
router.route("/cart").get(verifyJWT, getCart);
router.route("/cart/add").post(verifyJWT, addToCart);
router.route("/cart/merge").post(verifyJWT, mergeCart);
router.route("/cart/update").patch(verifyJWT, updateCartQuantity);
router.route("/cart/remove").delete(verifyJWT, removeFromCart);
router.route("/cart/clear").delete(verifyJWT, clearCart);


// order tracking
// router.route("/order/track/:awb").get(verifyJWT,trackShipmentByAwb)
router.route("/order/track/:awb").get(verifyJWT,trackOrderByAwb)

export default router;