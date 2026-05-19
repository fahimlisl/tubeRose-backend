import { Review } from "../models/review.model.ts";
import { asyncHandler } from "../utils/AsyncHandler.ts";
import { ApiError } from "../utils/ApiError.ts";
import { ApiResponse } from "../utils/ApiResponse.ts";
import { Request, Response } from "express";
import { Order } from "../models/order.model.ts";
import { Types } from "mongoose";
import { uploadOnCloudinary } from "../utils/cloudinary.ts";

const addReview = asyncHandler(async (req: Request, res: Response) => {
  const { body, title, rating } = req.body;
  const productId = new Types.ObjectId(req.params.productId as string); 
  const userId    = req.user?._id;

  if (!title || !body || rating === undefined)
    throw new ApiError(400, "title, body and rating are required.");

  if (rating < 1 || rating > 5)
    throw new ApiError(400, "Rating must be between 1 and 5.");

  const alreadyReviewed = await Review.exists({ product: productId, user: userId });
  if (alreadyReviewed)
    throw new ApiError(400, "You have already reviewed this product.");
     let imageData: { url: string; public_id: string }[] = [];
    const files = req.files as Express.Multer.File[];
    // images are optional , only run the if block if user wants to upload a image as review
    if(files){
        const uploadedImages = await Promise.all(
            files.map((file) => uploadOnCloudinary(file.buffer))
        );
        const failedUpload = uploadedImages.some((img) => !img?.url || !img?.public_id);
        if (failedUpload) {
            throw new ApiError(500, "one or more images failed to upload, try again!");
        }
        
        imageData = uploadedImages.map((file) => ({
            url: file.url,
            public_id: file.public_id,
        }));
    }

  const hasPurchased = await Order.exists({
    user:            userId,
    orderStatus:     "delivered",
    "items.product": productId,
  });

  const review = await Review.create({
    product:            productId, 
    user:               userId,
    rating,
    title:              title.trim(),
    body:               body.trim(),
    isVerifiedPurchase: !!hasPurchased,
    images: imageData || []
  });

  return res
    .status(201)
    .json(new ApiResponse(201, review, "Review submitted sucessfully."));
});

const fetchAllReviewsForAProduct = asyncHandler(async(req:Request,res:Response) => {
    const productId = req.query.productId as string
    const reviews = await Review.find({ product: productId })
    .populate("user", "name")
    .sort({ createdAt: -1 });
    if(!reviews){
        return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                {},
                "Be the first to reveiw this product"
            )
        )
    }
    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            reviews,
            "reviews have been successfully fetched"
        )
    )
})


export {
    addReview,
    fetchAllReviewsForAProduct
}