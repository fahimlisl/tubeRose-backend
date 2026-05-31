import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.ts";
import {
  createOrder,
  verifyAndSaveOrder,
  getOrder,
  getUserOrders,
  getAllOrders,
  getParticularOrder,
  createCodOrder,
} from "../controllers/order.controller.ts";
import { cancelOrder, adminCancelOrder } from "../controllers/order.controller.ts";
import { isAdmin } from "../middlewares/isAdmin.middleware.ts";

const router = Router();

router.route("/user/create").post(verifyJWT, createOrder);
router.route("/user/create/cod").post(verifyJWT, createCodOrder);
router.route("/user/verify").post(verifyJWT, verifyAndSaveOrder);
router.route("/user/all").get(verifyJWT, getUserOrders);
router.route("/user/:orderId").get(verifyJWT, getOrder);

router.route("/admin/all").get(verifyJWT,isAdmin,getAllOrders)
router.route("/admin/:orderId").get(verifyJWT,isAdmin,getParticularOrder)


// User route
router.route("/user/cancel/:orderId").post(verifyJWT, cancelOrder);

// Admin route  
router.route("/admin/cancel/:orderId").post(verifyJWT, isAdmin, adminCancelOrder);

export default router;