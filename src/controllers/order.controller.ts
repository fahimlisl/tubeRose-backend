import { asyncHandler } from "../utils/AsyncHandler.ts";
import { ApiError } from "../utils/ApiError.ts";
import { ApiResponse } from "../utils/ApiResponse.ts";
import { Request, Response } from "express";
import { User } from "../models/user.model.ts";
import { Product } from "../models/product.model.ts";
import { Order } from "../models/order.model.ts";
import Razorpay from "razorpay";
import crypto from "crypto";
import { createShiprocketOrder, assignAWB, requestPickup, checkServiceability } from "../utils/shiprocket.ts";
import { CouponUsage } from "../models/couponUsage.model.ts";
import { Coupon } from "../models/coupon.model.ts";

const razorpay = new Razorpay({
  key_id:     process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

const createOrder = asyncHandler(async (req: Request, res: Response) => {
  const { shippingAddress, discount, cartCategories } = req.body;
 
  if (!shippingAddress)              throw new ApiError(400, "shipping address is required!");
  if (!shippingAddress.fullName)     throw new ApiError(400, "fullName is required!");
  if (!shippingAddress.phone)        throw new ApiError(400, "phone is required!");
  if (!shippingAddress.addressLine1) throw new ApiError(400, "addressLine1 is required!");
  if (!shippingAddress.city)         throw new ApiError(400, "city is required!");
  if (!shippingAddress.state)        throw new ApiError(400, "state is required!");
  if (!shippingAddress.pincode)      throw new ApiError(400, "pincode is required!");
 
  const user = await User.findById(req.user._id).populate({
    path:   "cart.product",
    model:  "Product",
    select: "title image sizes",
  });
 
  if (!user)                                throw new ApiError(404, "user not found!");
  if (!user.cart || user.cart.length === 0) throw new ApiError(400, "cart is empty!");
 
  const orderItems: {
    product:   string;
    name:      string;
    sizeLabel: string;
    price:     number;
    quantity:  number;
    image:     string;
  }[] = [];
 
  let baseAmount = 0;
 
  for (const cartItem of user.cart) {
    const product = cartItem.product as any;
    if (!product?._id) throw new ApiError(400, "invalid product in cart!");
 
    const sizeVariant = product.sizes?.find((s: any) => s.label === cartItem.sizeLabel);
 
    if (!sizeVariant) {
      throw new ApiError(400, `size "${cartItem.sizeLabel}" not found for "${product.title}"`);
    }
    if (sizeVariant.stock < cartItem.quantity) {
      throw new ApiError(400, `only ${sizeVariant.stock} unit(s) of "${product.title}" (${cartItem.sizeLabel}) available`);
    }
 
    const thumbnail =
      product.image?.find((img: any) => img.isThumbnail)?.url ??
      product.image?.[0]?.url ?? "";
 
    orderItems.push({
      product:   product._id.toString(),
      name:      product.title,
      sizeLabel: cartItem.sizeLabel,
      price:     sizeVariant.finalPrice,
      quantity:  cartItem.quantity,
      image:     thumbnail,
    });
 
    baseAmount += sizeVariant.finalPrice * cartItem.quantity;
  }
 
  const shippingCost = baseAmount >= 499 ? 0 : 99;
  let   totalAmount  = baseAmount + shippingCost;
 
  if (discount?.code) {
    const coupon = await validateCoupon(
      discount.code,
      baseAmount,
      cartCategories ?? [],
      req.user._id.toString()
    );
    const discountAmount = calculateDiscount(coupon, baseAmount);
    totalAmount = totalAmount - discountAmount;
  }
 
  try {
    const razorpayOrder = await razorpay.orders.create({
      amount:   totalAmount * 100,  
      currency: "INR",
      receipt:  `rcpt_${req.user._id.toString().slice(-6)}_${Date.now().toString().slice(-6)}`,
    });
 
    return res.status(200).json(
      new ApiResponse(200, {
        razorpayOrderId: razorpayOrder.id,
        amount:          totalAmount, 
        baseAmount,
        shippingCost,
        currency:        "INR",
        orderItems,
        shippingAddress,
      }, "razorpay order created!")
    );
  } catch (err: any) {
    console.error("Razorpay error:", err);
    throw new ApiError(500, err?.error?.description ?? "Failed to create Razorpay order");
  }
});



const getOrder = asyncHandler(async (req: Request, res: Response) => {
  const { orderId } = req.params;
  const order = await Order.findOne({ _id: orderId, user: req.user._id });
  if (!order) throw new ApiError(404, "order not found!");
  return res.status(200).json(new ApiResponse(200, order, "order fetched!"));
});

const getAllOrders = asyncHandler(async(req:Request,res:Response) => {
  const orders = await Order.find({}).populate("user");
  if(!orders) {
    return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        orders,
        "no orders have been placed yet."
      )
    )
  };
  return res
  .status(200)
  .json(
    new ApiResponse(
      200,
      orders,
      "orders have been fetcehd successfully"
    )
  )
});

const getParticularOrder = asyncHandler(async(req:Request,res:Response) => {
  const { orderId } = req.params;
  if(!orderId) throw new ApiError(400,"order id required.");
  const order = await Order.findById(orderId).populate("user");
  if(!order) throw new ApiError(400,"order was not able to found.");
  return res
  .status(200)
  .json(
    new ApiResponse(
      200,
      order,
      "order has been fetched successfully."
    )
  )
})

const getUserOrders = asyncHandler(async (req: Request, res: Response) => {
  const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });
  return res.status(200).json(new ApiResponse(200, orders, "orders fetched!"));
});

const calculateDiscount = (
  coupon: { typeOfCoupon: string; value: number; maxDiscount?: number },
  cartAmount: number
): number => {
  let discount = 0;
  if (coupon.typeOfCoupon === "flat") {
    discount = coupon.value;
  } else {
    discount = Math.round((cartAmount * coupon.value) / 100);
    if (coupon.maxDiscount) {
      discount = Math.min(discount, coupon.maxDiscount);
    }
  }
  return Math.min(discount, cartAmount);
};

const validateCoupon = async (
  code: string,
  cartAmount: number,
  cartCategories: string[],
  userId: string
) => {
  const coupon = await Coupon.findOne({
    code: code.toUpperCase().trim(),
    isActive: true,
  });
  if (!coupon) throw new ApiError(404, "Invalid or inactive coupon.");

  if (coupon.expiryDate && new Date() > coupon.expiryDate)
    throw new ApiError(400, "Coupon has expired.");

  if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit)
    throw new ApiError(400, "Coupon usage limit has been reached.");

  if (cartAmount < coupon.minCartAmount)
    throw new ApiError(
      400,
      `Minimum cart amount of ₹${coupon.minCartAmount} required for this coupon.`
    );

  if (coupon.category !== "ALL") {
    if (!cartCategories?.includes(coupon.category))
      throw new ApiError(400, `This coupon is only valid for ${coupon.category} products.`);
  }

  if (coupon.isForFirstTimeUser) {
    const previousOrders = await Order.countDocuments({ user: userId });
    if (previousOrders > 0)
      throw new ApiError(400, "This coupon is only valid for first-time orders.");
  }

  if (coupon.perUserLimit) {
    const timesUsed = await CouponUsage.countDocuments({
      coupon: coupon._id,
      user: userId,
    });
    if (timesUsed >= coupon.perUserLimit)
      throw new ApiError(400, "You have already used this coupon.");
  }

  return coupon;
};


export const applyCoupon = asyncHandler(async (req: Request, res: Response) => {
  const { code, cartAmount, cartCategories } = req.body;

  if (!code || !cartAmount)
    throw new ApiError(400, "code and cartAmount are required.");

  const coupon = await validateCoupon(
    code,
    cartAmount,
    cartCategories ?? [],
    req.user._id.toString()
  );

  const discountAmount = calculateDiscount(coupon, cartAmount);
  const finalAmount    = cartAmount - discountAmount;

  return res.status(200).json(
    new ApiResponse(200, {
      code:          coupon.code,
      discountAmount,
      finalAmount,
      typeOfCoupon:  coupon.typeOfCoupon,
      message:       `You saved ₹${discountAmount}!`,
    }, "Coupon applied successfully.")
  );
});

const verifyAndSaveOrder = asyncHandler(async (req: Request, res: Response) => {
  const {
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
    shippingAddress,
    orderItems,
    baseAmount,
    shippingCost,
    totalAmount,
    cartCategories,
    discount, 
  } = req.body;

  if (!razorpayOrderId)    throw new ApiError(400, "razorpayOrderId is required!");
  if (!razorpayPaymentId)  throw new ApiError(400, "razorpayPaymentId is required!");
  if (!razorpaySignature)  throw new ApiError(400, "razorpaySignature is required!");
  if (!shippingAddress)    throw new ApiError(400, "shippingAddress is required!");
  if (!orderItems?.length) throw new ApiError(400, "orderItems are required!");

  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");

  if (expectedSignature !== razorpaySignature)
    throw new ApiError(400, "payment verification failed — invalid signature!");

  const { pincode } = shippingAddress;
  if (!pincode || !/^\d{6}$/.test(pincode))
    throw new ApiError(400, "valid 6-digit pincode is required in shipping address!");

  try {
    const serviceabilityData = await checkServiceability(pincode);
    const couriers: any[] = serviceabilityData?.data?.available_courier_companies ?? [];
    if (couriers.length === 0)
      throw new ApiError(400, `delivery is not available at pincode ${pincode}.`);
  } catch (err: any) {
    if (err instanceof ApiError) throw err;
    console.error("Serviceability check failed (non-blocking):", err.message);
  }
  let verifiedDiscount: { code: string; amount: number } | undefined;

  if (discount?.code) {
    const coupon = await validateCoupon(
      discount.code,
      baseAmount,
      cartCategories ?? [],
      req.user._id.toString()
    );
    const recalculated = calculateDiscount(coupon, baseAmount);
    verifiedDiscount = {
      code:   coupon.code,
      amount:recalculated
    };
  }
  const order = await Order.create({
    user:             req.user._id,
    items:            orderItems,
    shippingAddress,
    paymentMethod:    "razorpay",
    paymentStatus:    "paid",
    orderStatus:      "placed",
    razorpayOrderId,
    razorpayPaymentId,
    baseAmount,
    totalAmount,
    shiprocketStatus: "pending",
    ...(verifiedDiscount ? { discount: verifiedDiscount } : {}),
  });
  for (const item of orderItems) {
    await Product.updateOne(
      { _id: item.product, "sizes.label": item.sizeLabel },
      { $inc: { "sizes.$.stock": -item.quantity } }
    );
  }
  await User.findByIdAndUpdate(req.user._id, { $set: { cart: [] } });
  if (verifiedDiscount) {
    const coupon = await Coupon.findOne({
      code: verifiedDiscount.code.toUpperCase().trim(),
    });
    if (coupon) {
      await CouponUsage.create({
        coupon: coupon._id,
        user:   req.user._id,
        order:  order._id,
      });
      await Coupon.findByIdAndUpdate(coupon._id, {
        $inc: { usedCount: 1 },
      });
    }
  }
  res.status(201).json(
    new ApiResponse(201, { orderId: order._id }, "order placed successfully!")
  );
  createShiprocketOrder({
    orderId:   order._id.toString(),
    orderDate: order.createdAt.toISOString(),
    shippingAddress,
    items: orderItems.map((item: any) => ({
      name:      item.name,
      sizeLabel: item.sizeLabel,
      price:     item.price,
      quantity:  item.quantity,
    })),
    totalAmount,
    baseAmount,
  })
    .then(async (shipmentId) => {
      const awbCode = await assignAWB(shipmentId);
      await requestPickup(shipmentId);
      await Order.findByIdAndUpdate(order._id, {
        shiprocketShipmentId: shipmentId,
        shiprocketStatus:     "pickup_requested",
        awbCode,
        orderStatus:          "processing",
      });
    })
    .catch(async (err) => {
      await Order.findByIdAndUpdate(order._id, {
        shiprocketStatus: "failed",
      });
      console.error(
        `❌ Shiprocket automation failed for orderId ${order._id}:`,
        err.message
      );
    });
});


export {
  createOrder,
  verifyAndSaveOrder,
  getOrder,
  getUserOrders,
  getAllOrders,
  getParticularOrder,
};