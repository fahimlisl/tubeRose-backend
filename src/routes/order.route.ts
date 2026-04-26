import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.ts";
import {
  createOrder,
  verifyAndSaveOrder,
  getOrder,
  getUserOrders,
  getAllOrders,
  getParticularOrder,
} from "../controllers/order.controller.ts";
import { isAdmin } from "../middlewares/isAdmin.middleware.ts";

const router = Router();

router.route("/user/create").post(verifyJWT, createOrder);
router.route("/user/verify").post(verifyJWT, verifyAndSaveOrder);
router.route("/user/all").get(verifyJWT, getUserOrders);
router.route("/user/:orderId").get(verifyJWT, getOrder);

router.route("/admin/all").get(verifyJWT,isAdmin,getAllOrders)
router.route("/admin/:orderId").get(verifyJWT,isAdmin,getParticularOrder)

export default router;