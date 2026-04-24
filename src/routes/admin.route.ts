import { Router } from "express";
import { adminLogin, adminLogout, refreshAccessTokenAdmin, registerAdmin } from "../controllers/admin.controller.ts";
import { verifyJWT } from "../middlewares/auth.middleware.ts";
import { addProduct, editProduct, fetchAllProducts, fetchParticularProduct, removeProduct } from "../controllers/product.controller.ts";
import { upload } from "../middlewares/multer.middleware.ts";
import { isAdmin } from "../middlewares/isAdmin.middleware.ts";


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

export default router;