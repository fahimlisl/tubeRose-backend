import { Router } from "express";
import { adminLogin, adminLogout, refreshAccessTokenAdmin, registerAdmin } from "../controllers/admin.controller.ts";
import { verifyJWT } from "../middlewares/auth.middleware.ts";


const router = Router();

router.route("/register").post(registerAdmin);
router.route("/login").post(adminLogin)
router.route("/logout").post(verifyJWT,adminLogout)
router.route("/refresh/access-token").post(refreshAccessTokenAdmin)


export default router;