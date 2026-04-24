import { asyncHandler } from "../utils/AsyncHandler.ts";
import { ApiError } from "../utils/ApiError.ts";
import { ApiResponse } from "../utils/ApiResponse.ts";
import { Request, Response } from "express";
import { uploadOnCloudinary, deleteFromCloudinary } from "../utils/cloudinary.ts";
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


const editProduct = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const existingProduct = await Product.findById(id);
    if (!existingProduct) {
        throw new ApiError(404, "product not found!");
    }
    const { title, category, description, skinType, sizes, productDetails, removedImagePublicIds } = req.body;
    if (title !== undefined && !title.toString().trim()) {
        throw new ApiError(400, "title cannot be empty!");
    }
    if (category !== undefined && !category.toString().trim()) {
        throw new ApiError(400, "category cannot be empty!");
    }
    if (description !== undefined && !description.toString().trim()) {
        throw new ApiError(400, "description cannot be empty!");
    }
    let parsedSkinType;
    if (skinType !== undefined) {
        const validSkinTypes = ["oily", "dry", "combination", "sensitive", "normal"];

        parsedSkinType = typeof skinType === "string"
            ? JSON.parse(skinType)
            : skinType;

        if (!Array.isArray(parsedSkinType) || parsedSkinType.length === 0) {
            throw new ApiError(400, "at least one skinType is required!");
        }
        const invalidSkin = parsedSkinType.find((s: string) => !validSkinTypes.includes(s));
        if (invalidSkin) {
            throw new ApiError(400, `invalid skinType: "${invalidSkin}"`);
        }
    }
    let parsedSizes;
    if (sizes !== undefined) {
        const validLabels = ["15ml", "30ml", "50ml", "100ml", "200ml", "15g", "30g", "50g", "100g", "200g"];
        const validUnits = ["ml", "g"];

        parsedSizes = typeof sizes === "string"
            ? JSON.parse(sizes)
            : sizes;

        if (!Array.isArray(parsedSizes) || parsedSizes.length === 0) {
            throw new ApiError(400, "at least one size variant is required!");
        }
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
    }
    let parsedProductDetails;
    if (productDetails !== undefined) {
        parsedProductDetails = typeof productDetails === "string"
            ? JSON.parse(productDetails)
            : productDetails;

        if (!Array.isArray(parsedProductDetails)) {
            throw new ApiError(400, "productDetails must be an array!");
        }
    }


    let parsedRemovedIds: string[] = [];
    if (removedImagePublicIds) {
        parsedRemovedIds = typeof removedImagePublicIds === "string"
            ? JSON.parse(removedImagePublicIds)
            : removedImagePublicIds;

        await Promise.all(parsedRemovedIds.map((pid: string) => deleteFromCloudinary(pid)));
    }

    let currentImages = existingProduct.image.filter(
        (img: any) => !parsedRemovedIds.includes(img.public_id)
    );

    const files = req.files as Express.Multer.File[];

    if (files?.length) {
        const uploadedImages = await Promise.all(
            files.map((file) => uploadOnCloudinary(file.buffer))
        );

        const failedUpload = uploadedImages.some((img) => !img?.url || !img?.public_id);
        if (failedUpload) {
            throw new ApiError(500, "one or more images failed to upload, try again!");
        }

        const newImageData = uploadedImages.map((file) => ({
            url: file.url,
            public_id: file.public_id,
            isThumbnail: false, 
        }));

        currentImages = [...currentImages, ...newImageData];
    }

    if (currentImages.length === 0) {
        throw new ApiError(400, "product must have at least one image!");
    }

    const hasThumbnail = currentImages.some((img: any) => img.isThumbnail);
    if (!hasThumbnail) {
        currentImages[0].isThumbnail = true;
    }

    const updatePayload: Record<string, any> = {
        image: currentImages,
    };

    if (title !== undefined)                updatePayload.title          = title.trim();
    if (category !== undefined)             updatePayload.category       = category.trim();
    if (description !== undefined)          updatePayload.description    = description.trim();
    if (parsedSkinType !== undefined)       updatePayload.skinType       = parsedSkinType;
    if (parsedSizes !== undefined)          updatePayload.sizes          = parsedSizes;
    if (parsedProductDetails !== undefined) updatePayload.productDetails = parsedProductDetails;

    const updatedProduct = await Product.findByIdAndUpdate(
        id,
        { $set: updatePayload },
        { new: true, runValidators: true }
    );

    return res
        .status(200)
        .json(new ApiResponse(200, updatedProduct, "product updated successfully!"));
});

const removeProduct = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    if (!id) throw new ApiError(400, "product id is required.");

    const product = await Product.findById(id);
    if (!product) throw new ApiError(404, "product not found!");

    await Promise.all(
        product.image.map((img) => deleteFromCloudinary(img.public_id))
    );

    await Product.findByIdAndDelete(id);

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "product has been removed successfully."));
});

const fetchAllProducts = asyncHandler(async(req:Request,res:Response) => {
    const products = await Product.find({});
    if(!products) {
        return res
        .status(200)
        .json(
            new ApiResponse(
            200,
            {},
            "no products been added yet")
        )
    }

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            products,
            "fetched all products"
        )
    )
});

const fetchParticularProduct = asyncHandler(async(req:Request,res:Response) => {
    const { id } = req.params;
    if(!id) throw new ApiError(400,"id required to fetch a prodcut");
    const product = await Product.findById(id);
    if(!product) throw new ApiError(400,"product was not able to found.");
    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            product,
            "product has been fetched successfully"
        )
    )
})


export { addProduct , editProduct , removeProduct , fetchAllProducts ,fetchParticularProduct};