import { asyncHandler } from "../utils/AsyncHandler.ts";
import { ApiError } from "../utils/ApiError.ts";
import { ApiResponse } from "../utils/ApiResponse.ts";
import { Request, Response } from "express";
import { uploadOnCloudinary } from "../utils/cloudinary.ts";
import { Product } from "../models/product.model.ts";

const addProduct = asyncHandler(async (req: Request, res: Response) => {
    const { title, category, description, skinType, sizes, productDetails } = req.body;
    if ([title, category, description].some((f) => !f || !f.toString().trim())) {
        throw new ApiError(400, "title, category and description are required!");
    }
    const validSkinTypes = ["oily", "dry", "combination", "sensitive", "normal"];
    const parsedSkinType: string[] = typeof skinType === "string"
        ? JSON.parse(skinType) 
        : skinType;

    if (!Array.isArray(parsedSkinType) || parsedSkinType.length === 0) {
        throw new ApiError(400, "at least one skinType is required!");
    }
    const invalidSkin = parsedSkinType.find((s) => !validSkinTypes.includes(s));
    if (invalidSkin) {
        throw new ApiError(400, `invalid skinType: "${invalidSkin}"`);
    }
    const parsedSizes = typeof sizes === "string"
        ? JSON.parse(sizes)
        : sizes;

    if (!Array.isArray(parsedSizes) || parsedSizes.length === 0) {
        throw new ApiError(400, "at least one size variant is required!");
    }

    const validLabels = ["15ml","30ml","50ml","100ml","200ml","15g","30g","50g","100g","200g"];
    const validUnits  = ["ml", "g"];

    for (const size of parsedSizes) {
        if (!size.label || !validLabels.includes(size.label)) {
            throw new ApiError(400, `invalid or missing label: "${size.label}"`);
        }
        if (!size.unit || !validUnits.includes(size.unit)) {
            throw new ApiError(400, `invalid or missing unit: "${size.unit}"`);
        }
        if (size.finalPrice === undefined || isNaN(Number(size.finalPrice))) {
            throw new ApiError(400, `finalPrice is required for size "${size.label}"`);
        }
        if (size.basePrice !== undefined && isNaN(Number(size.basePrice))) {
            throw new ApiError(400, `invalid basePrice for size "${size.label}"`);
        }
    }

    let parsedProductDetails = [];
    if (productDetails) {
        parsedProductDetails = typeof productDetails === "string"
            ? JSON.parse(productDetails)
            : productDetails;

        if (!Array.isArray(parsedProductDetails)) {
            throw new ApiError(400, "productDetails must be an array!");
        }
    }

    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
        throw new ApiError(400, "at least one image is required!");
    }

    const uploadedImages = await Promise.all(
        files.map((file) => uploadOnCloudinary(file.buffer))
    );
    const failedUpload = uploadedImages.some((img) => !img?.url || !img?.public_id);
    if (failedUpload) {
        throw new ApiError(500, "one or more images failed to upload, try again!");
    }

    const imageData = uploadedImages.map((file, index) => ({
        url: file.url,
        public_id: file.public_id,
        isThumbnail: index === 0, 
    }));

    const product = await Product.create({
        title:          title.trim(),
        category:       category.trim(),
        description:    description.trim(),
        skinType:       parsedSkinType,
        sizes:          parsedSizes,
        productDetails: parsedProductDetails,
        image:          imageData,
    });

    if (!product) {
        throw new ApiError(500, "internal server error, failed to add product!");
    }

    return res
        .status(201)
        .json(new ApiResponse(201, product, "product has been added successfully!"));
});



export { addProduct };