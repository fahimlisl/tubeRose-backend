import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.ts";
import {
  createOrder,
  verifyAndSaveOrder,
  getOrder,
  getUserOrders,
} from "../controllers/order.controller.ts";

const router = Router();

// POST /api/v1/user/order/create    — validates cart + creates razorpay order
// POST /api/v1/user/order/verify    — verifies payment + saves order to DB
// GET  /api/v1/user/order/all       — get all orders for logged in user
// GET  /api/v1/user/order/:orderId  — get single order

router.route("/user/create").post(verifyJWT, createOrder);
router.route("/user/verify").post(verifyJWT, verifyAndSaveOrder);
router.route("/user/all").get(verifyJWT, getUserOrders);
router.route("/user/:orderId").get(verifyJWT, getOrder);

export default router;