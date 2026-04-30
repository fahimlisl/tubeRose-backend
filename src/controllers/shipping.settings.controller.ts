
import { Request, Response }        from "express";
import { asyncHandler }             from "../utils/AsyncHandler.ts";
import { ApiError }                 from "../utils/ApiError.ts";
import { ApiResponse }              from "../utils/ApiResponse.ts";
import { Shipping }                 from "../models/shipping.settings.model.ts";
import { getShippingConfig, invalidateShippingCache } from "../utils/shippingConfig.ts";
 
export const getShippingSettings = asyncHandler(
  async (_req: Request, res: Response) => {
    const config = await getShippingConfig(); 
 
    return res
      .status(200)
      .json(new ApiResponse(200, config, "Shipping settings fetched."));
  }
);
 
export const updateShippingSettings = asyncHandler(
  async (req: Request, res: Response) => {
    const { freeShippingEnabled, freeShippingThreshold, defaultShippingCost } =
      req.body;
 
    if (
      freeShippingThreshold !== undefined &&
      (isNaN(Number(freeShippingThreshold)) || Number(freeShippingThreshold) < 0)
    ) {
      throw new ApiError(400, "freeShippingThreshold must be a non-negative number.");
    }
 
    if (
      defaultShippingCost !== undefined &&
      (isNaN(Number(defaultShippingCost)) || Number(defaultShippingCost) < 0)
    ) {
      throw new ApiError(400, "defaultShippingCost must be a non-negative number.");
    }
 
    let config = await Shipping.findOne({ isActive: true });
 
    if (!config) {
      config = await Shipping.create({
        freeShippingEnabled:   freeShippingEnabled   ?? false,
        freeShippingThreshold: freeShippingThreshold ?? 499,
        defaultShippingCost:   defaultShippingCost   ?? 99,
        isActive:              true,
        updatedBy:             req.user?.email ?? "admin",
      });
    } else {
      if (freeShippingEnabled   !== undefined) config.freeShippingEnabled   = Boolean(freeShippingEnabled);
      if (freeShippingThreshold !== undefined) config.freeShippingThreshold = Number(freeShippingThreshold);
      if (defaultShippingCost   !== undefined) config.defaultShippingCost   = Number(defaultShippingCost);
      config.updatedBy = req.user?.email ?? "admin";
      await config.save();
    }
 
    invalidateShippingCache();
 
    return res
      .status(200)
      .json(new ApiResponse(200, config, "Shipping settings updated."));
  }
);
 
export const getPublicShippingInfo = asyncHandler(
  async (_req: Request, res: Response) => {
    const config = await getShippingConfig();
 
    return res.status(200).json(
      new ApiResponse(
        200,
        {
          freeShippingEnabled:   config.freeShippingEnabled,
          freeShippingThreshold: config.freeShippingThreshold,
          defaultShippingCost:   config.defaultShippingCost,
        },
        "Shipping info fetched."
      )
    );
  }
);
 