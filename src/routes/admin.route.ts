import { Router } from "express";
import { adminLogin, adminLogout, refreshAccessTokenAdmin, registerAdmin } from "../controllers/admin.controller.ts";
import { verifyJWT } from "../middlewares/auth.middleware.ts";
import { addProduct } from "../controllers/product.controller.ts";
import { upload } from "../middlewares/multer.middleware.ts";
import { isAdmin } from "../middlewares/isAdmin.middleware.ts";


const router = Router();

router.route("/register").post(registerAdmin);
router.route("/login").post(adminLogin)
router.route("/logout").post(verifyJWT,adminLogout)
router.route("/refresh/access-token").post(refreshAccessTokenAdmin)

// product
router.route("/add/product").post(verifyJWT,isAdmin,upload.array("image",3),addProduct)


export default router;