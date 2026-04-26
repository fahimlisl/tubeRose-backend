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

const razorpay = new Razorpay({
  key_id:     process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

const createOrder = asyncHandler(async (req: Request, res: Response) => {
  const { shippingAddress } = req.body;

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

    const sizeVariant = product.sizes?.find(
      (s: any) => s.label === cartItem.sizeLabel
    );

    if (!sizeVariant) {
      throw new ApiError(
        400,
        `size "${cartItem.sizeLabel}" not found for "${product.title}"`
      );
    }

    if (sizeVariant.stock < cartItem.quantity) {
      throw new ApiError(
        400,
        `only ${sizeVariant.stock} unit(s) of "${product.title}" (${cartItem.sizeLabel}) available`
      );
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
  const totalAmount  = baseAmount + shippingCost;

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
    discount,
  } = req.body;

  if (!razorpayOrderId)   throw new ApiError(400, "razorpayOrderId is required!");
  if (!razorpayPaymentId) throw new ApiError(400, "razorpayPaymentId is required!");
  if (!razorpaySignature) throw new ApiError(400, "razorpaySignature is required!");
  if (!shippingAddress)   throw new ApiError(400, "shippingAddress is required!");
  if (!orderItems?.length) throw new ApiError(400, "orderItems are required!");

  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");

  if (expectedSignature !== razorpaySignature) {
    throw new ApiError(400, "payment verification failed — invalid signature!");
  }

  const { pincode } = shippingAddress;
  if (!pincode || !/^\d{6}$/.test(pincode)) {
    throw new ApiError(400, "valid 6-digit pincode is required in shipping address!");
  }

  try {
    const serviceabilityData = await checkServiceability(pincode);
    const couriers: any[] = serviceabilityData?.data?.available_courier_companies ?? [];

    if (couriers.length === 0) {
      throw new ApiError(
        400,
        `delivery is not available at pincode ${pincode}. Please use a different address.`
      );
    }
  } catch (err: any) {
    if (err instanceof ApiError) throw err;
    console.error("Serviceability check failed (non-blocking):", err.message);
  }

  const order = await Order.create({
    user:              req.user._id,
    items:             orderItems,
    shippingAddress,
    paymentMethod:     "razorpay",
    paymentStatus:     "paid",
    orderStatus:       "placed",
    razorpayOrderId,
    razorpayPaymentId,
    baseAmount,
    totalAmount,
    shiprocketStatus:  "pending",
    ...(discount?.code ? { discount } : {}),
  });
  for (const item of orderItems) {
    await Product.updateOne(
      { _id: item.product, "sizes.label": item.sizeLabel },
      { $inc: { "sizes.$.stock": -item.quantity } }
    );
  }
  await User.findByIdAndUpdate(req.user._id, { $set: { cart: [] } });

  res.status(201).json(
    new ApiResponse(201, { orderId: order._id }, "order placed successfully!")
  );

  // ── NON-BLOCKING: full Shiprocket automation ──────────────────────────────
  // runs entirely in background after response is sent
  // any failure here is logged and saved to DB — user is never affected
  createShiprocketOrder({
    orderId:  order._id.toString(),
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
      // request pickup ( includes costing in here )
      await requestPickup(shipmentId);

      await Order.findByIdAndUpdate(order._id, {
        shiprocketShipmentId: shipmentId,
        shiprocketStatus:     "pickup_requested",
        awbCode,
        orderStatus:          "processing",
      });
    })
    .catch(async (err) => {
      // save failure state — you can build an admin retry endpoint later
      await Order.findByIdAndUpdate(order._id, {
        shiprocketStatus: "failed",
      });
      console.error(
        `❌ Shiprocket automation failed for orderId ${order._id}:`,
        err.message
      );
    });
});

const getOrder = asyncHandler(async (req: Request, res: Response) => {
  const { orderId } = req.params;
  const order = await Order.findOne({ _id: orderId, user: req.user._id });
  if (!order) throw new ApiError(404, "order not found!");
  return res.status(200).json(new ApiResponse(200, order, "order fetched!"));
});

const getUserOrders = asyncHandler(async (req: Request, res: Response) => {
  const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });
  return res.status(200).json(new ApiResponse(200, orders, "orders fetched!"));
});

export { createOrder, verifyAndSaveOrder, getOrder, getUserOrders };