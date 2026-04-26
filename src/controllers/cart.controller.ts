import { asyncHandler } from "../utils/AsyncHandler.ts";
import { ApiError } from "../utils/ApiError.ts";
import { ApiResponse } from "../utils/ApiResponse.ts";
import { Request, Response } from "express";
import { User } from "../models/user.model.ts";
import { Product } from "../models/product.model.ts";

const getCart = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.user._id).populate({
    path: "cart.product",
    model: "Product",
    select: "title category image sizes",
  });

  if (!user) throw new ApiError(404, "user not found!");

  return res
    .status(200)
    .json(new ApiResponse(200, user.cart, "cart fetched successfully!"));
});

const addToCart = asyncHandler(async (req: Request, res: Response) => {
  const { productId, sizeLabel, quantity = 1 } = req.body;
  if (!productId) throw new ApiError(400, "productId is required!");
  if (!sizeLabel) throw new ApiError(400, "sizeLabel is required!");

  const product = await Product.findById(productId);
  if (!product) throw new ApiError(404, "product not found!");

  const sizeVariant = product.sizes.find((s: any) => s.label === sizeLabel);
  if (!sizeVariant) throw new ApiError(400, "invalid size!");
  if (sizeVariant.stock === 0) throw new ApiError(400, "out of stock!");

  const user = await User.findById(req.user._id);
  if (!user) throw new ApiError(404, "user not found!");

  const existingItem = user.cart.find(
    (item) =>
      item.product.toString() === productId && item.sizeLabel === sizeLabel
  );

  if (existingItem) {
    existingItem.quantity += quantity;
  } else {
    user.cart.push({ product: productId, quantity, sizeLabel });
  }

  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, user.cart, "item added to cart!"));
});

const removeFromCart = asyncHandler(async (req: Request, res: Response) => {
  const { productId, sizeLabel } = req.body;

  if (!productId) throw new ApiError(400, "productId is required!");
  if (!sizeLabel) throw new ApiError(400, "sizeLabel is required!");

  const user = await User.findById(req.user._id);
  if (!user) throw new ApiError(404, "user not found!");

  user.cart = user.cart.filter(
    (item) =>
      !(item.product.toString() === productId && item.sizeLabel === sizeLabel)
  ) as typeof user.cart;

  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "item removed from cart!"));
});

const updateCartQuantity = asyncHandler(async (req: Request, res: Response) => {
  const { productId, sizeLabel, quantity } = req.body;

  if (!productId || !sizeLabel || quantity === undefined)
    throw new ApiError(400, "productId, sizeLabel and quantity are required!");

  const user = await User.findById(req.user._id);
  if (!user) throw new ApiError(404, "user not found!");

  if (quantity < 1) {
    user.cart = user.cart.filter(
      (item) =>
        !(item.product.toString() === productId && item.sizeLabel === sizeLabel)
    ) as typeof user.cart;
  } else {
    const item = user.cart.find(
      (item) =>
        item.product.toString() === productId && item.sizeLabel === sizeLabel
    );
    if (!item) throw new ApiError(404, "item not found in cart!");
    item.quantity = quantity;
  }

  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, user.cart, "cart updated!"));
});

const mergeCart = asyncHandler(async (req: Request, res: Response) => {
  const { anonymousCart } = req.body;

  if (!Array.isArray(anonymousCart) || anonymousCart.length === 0) {
    return res
      .status(200)
      .json(new ApiResponse(200, {}, "nothing to merge!"));
  }

  const user = await User.findById(req.user._id);
  if (!user) throw new ApiError(404, "user not found!");

  for (const anonItem of anonymousCart) {
    const { productId, sizeLabel, quantity = 1 } = anonItem;
    if (!sizeLabel) continue;

    const product = await Product.findById(productId);
    if (!product) continue;

    const existing = user.cart.find(
      (item) =>
        item.product.toString() === productId && item.sizeLabel === sizeLabel
    );

    if (existing) {
      existing.quantity += quantity;
    } else {
      user.cart.push({ product: productId, quantity, sizeLabel });
    }
  }

  await user.save({ validateBeforeSave: false });

  const populated = await User.findById(req.user._id).populate({
    path: "cart.product",
    model: "Product",
    select: "title category image sizes",
  });

  return res
    .status(200)
    .json(new ApiResponse(200, populated?.cart, "cart merged successfully!"));
});

const clearCart = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.user._id);
  if (!user) throw new ApiError(404, "user not found!");

  user.cart = [] as typeof user.cart;
  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "cart cleared!"));
});

export { getCart, addToCart, removeFromCart, updateCartQuantity, mergeCart, clearCart };