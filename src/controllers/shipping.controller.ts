import { asyncHandler } from "../utils/AsyncHandler.ts";
import { ApiError } from "../utils/ApiError.ts";
import { ApiResponse } from "../utils/ApiResponse.ts";
import { Request, Response } from "express";
import { checkServiceability } from "../utils/shiprocket.ts";

const checkPincodeServiceability = asyncHandler(async (req: Request, res: Response) => {
    const { pincode } = req.query;

    if (!pincode || !/^\d{6}$/.test(pincode as string)) {
        throw new ApiError(400, "valid 6 digit pincode required!");
    }

    const data = await checkServiceability(pincode as string);

    const couriers: any[] = data?.data?.available_courier_companies ?? [];

    if (couriers.length === 0) {
        return res.status(200).json(
            new ApiResponse(200, {
                serviceable: false,
                pincode,
                bestOption: null,
            }, "delivery not available at this pincode.")
        );
    }

    // ── Find fastest delivery partner ───────────────────────────────
    const sorted = couriers
        .filter(c => c.estimated_delivery_days != null)
        .sort((a, b) => a.estimated_delivery_days - b.estimated_delivery_days);

    const best = sorted[0];

    // ── Send only what frontend needs ───────────────────────────────
    return res.status(200).json(
        new ApiResponse(200, {
            serviceable: true,
            pincode,
            bestOption: {
                courierName:   best.courier_name,
                estimatedDays: best.estimated_delivery_days,
                etd:           best.etd, // estimated delivery date e.g "2024-12-25"
                cod:           best.cod === 1,
            },
        }, "delivery available!")
    );
});

export { checkPincodeServiceability };