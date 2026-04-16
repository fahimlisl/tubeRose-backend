import { Router } from "express";
import { registerAdmin } from "../controllers/admin.controller.ts";


const router = Router();

router.route("/register").post(registerAdmin);



export default router;