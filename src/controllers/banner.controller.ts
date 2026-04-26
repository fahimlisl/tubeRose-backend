import { asyncHandler } from "../utils/AsyncHandler";
import { ApiResponse } from "../utils/ApiResponse";
import { ApiError } from "../utils/ApiError";
import { Request, Response } from "express";
import { Banner } from "../models/banner.model";

export const createBanner = asyncHandler(async (req: Request, res: Response) => {
    const { message, priority, bgColor, startDate, endDate } = req.body;

    if (!message) throw new ApiError(400, "Message is required");

    const banner = await Banner.create({
        message,
        priority,
        bgColor,
        startDate,
        endDate,
    });

    res.status(201).json(new ApiResponse(201, banner, "Banner created successfully"));
});

export const getAllBanners = asyncHandler(async (req: Request, res: Response) => {
    const banners = await Banner.find().sort({ priority: -1, createdAt: -1 });

    res.status(200).json(new ApiResponse(200, banners, "Banners fetched successfully"));
});

export const getActiveBanners = asyncHandler(async (req: Request, res: Response) => {
    const now = new Date();

    const banners = await Banner.find({
        isActive: true,
        $and: [
            { $or: [{ startDate: { $lte: now } }, { startDate: null }] },
            { $or: [{ endDate: { $gte: now } }, { endDate: null }] },
        ],
    }).sort({ priority: -1 });

    res.status(200).json(new ApiResponse(200, banners, "Active banners fetched successfully"));
});

export const updateBanner = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const updates = req.body;

    if (Object.keys(updates).length === 0) throw new ApiError(400, "No update fields provided");

    const banner = await Banner.findByIdAndUpdate(
        id,
        { $set: updates },
        { new: true, runValidators: true }
    );

    if (!banner) throw new ApiError(404, "Banner not found");

    res.status(200).json(new ApiResponse(200, banner, "Banner updated successfully"));
});

export const toggleBanner = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const banner = await Banner.findById(id);

    if (!banner) throw new ApiError(404, "Banner not found");

    banner.isActive = !banner.isActive;
    await banner.save();

    res.status(200).json(
        new ApiResponse(200, banner, `Banner is now ${banner.isActive ? "active" : "inactive"}`)
    );
});

export const deleteBanner = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const banner = await Banner.findByIdAndDelete(id);

    if (!banner) throw new ApiError(404, "Banner not found");

    res.status(200).json(new ApiResponse(200, null, "Banner deleted successfully"));
});