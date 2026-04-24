import { Router } from "express";
import { loginUser, logoutUser, refreshAccessToken } from "../controllers/user.controller.ts";
import { verifyJWT } from "../middlewares/auth.middleware.ts";

const router = Router();

router.route("/auth/login").post(loginUser)
router.route("/auth/logout").post(verifyJWT,logoutUser)
router.route("/refresh/access-token").post(refreshAccessToken)


export default router;