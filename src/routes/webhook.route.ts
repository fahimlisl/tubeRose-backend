import { Router } from "express";
import { shiprocketWebhook } from "../controllers/webhook.controller.ts";

const router = Router();

// POST /webhook/shiprocket?secret=<SHIPROCKET_WEBHOOK_SECRET>
router.route("/shiprocket").post(shiprocketWebhook);

export default router;
