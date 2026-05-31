import { asyncHandler } from "../utils/AsyncHandler.ts";
import { ApiError } from "../utils/ApiError.ts";
import { ApiResponse } from "../utils/ApiResponse.ts";
import { Request, Response } from "express";
import { User } from "../models/user.model.ts";
import { Product } from "../models/product.model.ts";
import { Order } from "../models/order.model.ts";
import Razorpay from "razorpay";
import crypto from "crypto";
import {
  createShiprocketOrder,
  assignAWB,
  requestPickup,
  checkServiceability,
} from "../utils/shiprocket.ts";
import { CouponUsage } from "../models/couponUsage.model.ts";
import { Coupon } from "../models/coupon.model.ts";
import { WalletSettings } from "../models/wallet.settings.model.ts";
import {
  getShippingConfig,
  calculateShippingCost,
} from "../utils/shippingConfig.ts";

const getSettings = async () => {
  let s = await WalletSettings.findOne();
  if (!s) s = await WalletSettings.create({});
  return s;
};

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

const getOrder = asyncHandler(async (req: Request, res: Response) => {
  const { orderId } = req.params;
  const order = await Order.findOne({ _id: orderId, user: req.user._id });
  if (!order) throw new ApiError(404, "order not found!");
  return res.status(200).json(new ApiResponse(200, order, "order fetched!"));
});

const getAllOrders = asyncHandler(async (req: Request, res: Response) => {
  const orders = await Order.find({}).populate("user");
  if (!orders) {
    return res
      .status(200)
      .json(new ApiResponse(200, orders, "no orders have been placed yet."));
  }
  return res
    .status(200)
    .json(
      new ApiResponse(200, orders, "orders have been fetcehd successfully")
    );
});

const getParticularOrder = asyncHandler(async (req: Request, res: Response) => {
  const { orderId } = req.params;
  if (!orderId) throw new ApiError(400, "order id required.");
  const order = await Order.findById(orderId).populate("user");
  if (!order) throw new ApiError(400, "order was not able to found.");
  return res
    .status(200)
    .json(new ApiResponse(200, order, "order has been fetched successfully."));
});

const getUserOrders = asyncHandler(async (req: Request, res: Response) => {
  const orders = await Order.find({ user: req.user._id }).sort({
    createdAt: -1,
  });
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
      throw new ApiError(
        400,
        `This coupon is only valid for ${coupon.category} products.`
      );
  }

  if (coupon.isForFirstTimeUser) {
    const previousOrders = await Order.countDocuments({ user: userId });
    if (previousOrders > 0)
      throw new ApiError(
        400,
        "This coupon is only valid for first-time orders."
      );
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
  const finalAmount = cartAmount - discountAmount;

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        code: coupon.code,
        discountAmount,
        finalAmount,
        typeOfCoupon: coupon.typeOfCoupon,
        message: `You saved ₹${discountAmount}!`,
      },
      "Coupon applied successfully."
    )
  );
});

const createOrder = asyncHandler(async (req: Request, res: Response) => {
  const { shippingAddress, discount, cartCategories, walletUsage } = req.body;

  if (!shippingAddress)
    throw new ApiError(400, "shipping address is required!");
  if (!shippingAddress.fullName)
    throw new ApiError(400, "fullName is required!");
  if (!shippingAddress.phone) throw new ApiError(400, "phone is required!");
  if (!shippingAddress.addressLine1)
    throw new ApiError(400, "addressLine1 is required!");
  if (!shippingAddress.city) throw new ApiError(400, "city is required!");
  if (!shippingAddress.state) throw new ApiError(400, "state is required!");
  if (!shippingAddress.pincode) throw new ApiError(400, "pincode is required!");

  const user = await User.findById(req.user._id).populate({
    path: "cart.product",
    model: "Product",
    select: "title image sizes",
  });

  if (!user) throw new ApiError(404, "user not found!");
  if (!user.cart || user.cart.length === 0)
    throw new ApiError(400, "cart is empty!");

  const orderItems: {
    product: string;
    name: string;
    sizeLabel: string;
    price: number;
    quantity: number;
    image: string;
  }[] = [];

  let baseAmount = 0;

  for (const cartItem of user.cart) {
    const product = cartItem.product as any;
    if (!product?._id) throw new ApiError(400, "invalid product in cart!");

    const sizeVariant = product.sizes?.find(
      (s: any) => s.label === cartItem.sizeLabel
    );
    if (!sizeVariant)
      throw new ApiError(
        400,
        `size "${cartItem.sizeLabel}" not found for "${product.title}"`
      );
    if (sizeVariant.stock < cartItem.quantity)
      throw new ApiError(
        400,
        `only ${sizeVariant.stock} unit(s) of "${product.title}" (${cartItem.sizeLabel}) available`
      );

    const thumbnail =
      product.image?.find((img: any) => img.isThumbnail)?.url ??
      product.image?.[0]?.url ??
      "";

    orderItems.push({
      product: product._id.toString(),
      name: product.title,
      sizeLabel: cartItem.sizeLabel,
      price: sizeVariant.finalPrice,
      quantity: cartItem.quantity,
      image: thumbnail,
    });

    baseAmount += sizeVariant.finalPrice * cartItem.quantity;
  }

  const shippingConfig = await getShippingConfig();
  const shippingCost = calculateShippingCost(shippingConfig, baseAmount);
  let totalAmount = baseAmount + shippingCost;
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

  let walletDeduction = 0;
  if (walletUsage) {
    const settings = await getSettings();
    if (settings.walletSpendingEnabled) {
      const credits = (user.wallet as any[])
        .filter((w) => w.type === "credit")
        .reduce((s, w) => s + w.amount, 0);
      const debits = (user.wallet as any[])
        .filter((w) => w.type === "debit")
        .reduce((s, w) => s + w.amount, 0);
      const balance = credits - debits;

      const maxByPercent = Math.floor(
        (totalAmount * settings.walletSpendingMaxPercent) / 100
      );
      const maxAllowed = Math.min(
        maxByPercent,
        settings.walletSpendingMaxFixedCap
      );
      walletDeduction = Math.min(balance, maxAllowed, totalAmount);
      totalAmount = totalAmount - walletDeduction;
    }
  }

  try {
    const razorpayOrder = await razorpay.orders.create({
      amount: totalAmount * 100,
      currency: "INR",
      receipt: `rcpt_${req.user._id.toString().slice(-6)}_${Date.now().toString().slice(-6)}`,
    });

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          razorpayOrderId: razorpayOrder.id,
          amount: totalAmount,
          baseAmount,
          shippingCost,
          walletDeduction,
          currency: "INR",
          orderItems,
          shippingAddress,
        },
        "razorpay order created!"
      )
    );
  } catch (err: any) {
    console.error("Razorpay error:", err);
    throw new ApiError(
      500,
      err?.error?.description ?? "Failed to create Razorpay order"
    );
  }
});

const createCodOrder = asyncHandler(async (req: Request, res: Response) => {
  const { shippingAddress, discount, cartCategories, walletUsage } = req.body;

  if (!shippingAddress) throw new ApiError(400, "shipping address is required!");
  if (!shippingAddress.fullName) throw new ApiError(400, "fullName is required!");
  if (!shippingAddress.phone) throw new ApiError(400, "phone is required!");
  if (!shippingAddress.addressLine1) throw new ApiError(400, "addressLine1 is required!");
  if (!shippingAddress.city) throw new ApiError(400, "city is required!");
  if (!shippingAddress.state) throw new ApiError(400, "state is required!");
  if (!shippingAddress.pincode) throw new ApiError(400, "pincode is required!");

  const { pincode } = shippingAddress;
  const serviceabilityData = await checkServiceability(pincode);
  const couriers: any[] = serviceabilityData?.data?.available_courier_companies ?? [];
  if (couriers.length === 0)
    throw new ApiError(400, `delivery is not available at pincode ${pincode}.`);

  const codAvailable = couriers.some((c) => c.cod === 1);
  if (!codAvailable)
    throw new ApiError(400, "Cash on Delivery is not available at your pincode.");

  const user = await User.findById(req.user._id).populate({
    path: "cart.product",
    model: "Product",
    select: "title image sizes",
  });

  if (!user) throw new ApiError(404, "user not found!");
  if (!user.cart || user.cart.length === 0) throw new ApiError(400, "cart is empty!");

  const orderItems: {
    product: string;
    name: string;
    sizeLabel: string;
    price: number;
    quantity: number;
    image: string;
  }[] = [];

  let baseAmount = 0;

  for (const cartItem of user.cart) {
    const product = cartItem.product as any;
    if (!product?._id) throw new ApiError(400, "invalid product in cart!");

    const sizeVariant = product.sizes?.find((s: any) => s.label === cartItem.sizeLabel);
    if (!sizeVariant)
      throw new ApiError(400, `size "${cartItem.sizeLabel}" not found for "${product.title}"`);
    if (sizeVariant.stock < cartItem.quantity)
      throw new ApiError(
        400,
        `only ${sizeVariant.stock} unit(s) of "${product.title}" (${cartItem.sizeLabel}) available`
      );

    const thumbnail =
      product.image?.find((img: any) => img.isThumbnail)?.url ??
      product.image?.[0]?.url ??
      "";

    orderItems.push({
      product: product._id.toString(),
      name: product.title,
      sizeLabel: cartItem.sizeLabel,
      price: sizeVariant.finalPrice,
      quantity: cartItem.quantity,
      image: thumbnail,
    });

    baseAmount += sizeVariant.finalPrice * cartItem.quantity;
  }

  const shippingConfig = await getShippingConfig();
  const shippingCost = calculateShippingCost(shippingConfig, baseAmount);
  let totalAmount = baseAmount + shippingCost;

  let verifiedDiscount: { code: string; amount: number } | undefined;
  if (discount?.code) {
    const coupon = await validateCoupon(
      discount.code,
      baseAmount,
      cartCategories ?? [],
      req.user._id.toString()
    );
    const discountAmount = calculateDiscount(coupon, baseAmount);
    verifiedDiscount = { code: coupon.code, amount: discountAmount };
    totalAmount = totalAmount - discountAmount;
  }

  let walletDeduction = 0;
  if (walletUsage) {
    const settings = await getSettings();
    if (settings.walletSpendingEnabled) {
      const credits = (user.wallet as any[])
        .filter((w) => w.type === "credit")
        .reduce((s, w) => s + w.amount, 0);
      const debits = (user.wallet as any[])
        .filter((w) => w.type === "debit")
        .reduce((s, w) => s + w.amount, 0);
      const balance = credits - debits;

      const maxByPercent = Math.floor(
        (totalAmount * settings.walletSpendingMaxPercent) / 100
      );
      const maxAllowed = Math.min(maxByPercent, settings.walletSpendingMaxFixedCap);
      walletDeduction = Math.min(balance, maxAllowed, totalAmount);
      totalAmount = totalAmount - walletDeduction;
    }
  }

  const order = await Order.create({
    user: req.user._id,
    items: orderItems,
    shippingAddress,
    paymentMethod: "cod",
    paymentStatus: "pending",
    orderStatus: "placed",
    baseAmount,
    totalAmount,
    shiprocketStatus: "pending",
    ...(verifiedDiscount ? { discount: verifiedDiscount } : {}),
    ...(walletDeduction > 0 ? { walletDeduction } : {}),
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
      await CouponUsage.create({ coupon: coupon._id, user: req.user._id, order: order._id });
      await Coupon.findByIdAndUpdate(coupon._id, { $inc: { usedCount: 1 } });
    }
  }

  if (walletDeduction > 0) {
    await User.findByIdAndUpdate(req.user._id, {
      $push: {
        wallet: {
          amount: walletDeduction,
          type: "debit",
          source: "order",
          source_id: order._id,
          description: `wallet redeemed on COD order`,
        },
      },
    });
  }

  const settings = await getSettings();
  if (settings.walletCashbackEnabled && settings.walletCashbackPercent > 0) {
    const cashback = Math.floor((baseAmount * settings.walletCashbackPercent) / 100);
    if (cashback > 0) {
      await User.findByIdAndUpdate(req.user._id, {
        $push: {
          wallet: {
            amount: cashback,
            type: "credit",
            source: "cashback",
            source_id: order._id,
            description: `${settings.walletCashbackPercent}% cashback on COD order`,
          },
        },
      });
    }
  }
  res.status(201).json(
    new ApiResponse(201, { orderId: order._id }, "COD order placed successfully!")
  );

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));


  createShiprocketOrder({
    orderId: order._id.toString(),
    orderDate: order.createdAt.toISOString(),
    shippingAddress,
    items: orderItems.map((item) => ({
      name: item.name,
      sizeLabel: item.sizeLabel,
      price: item.price,
      quantity: item.quantity,
    })),
    totalAmount,
    baseAmount,
  })
    .then(async (shipmentId) => {
       await sleep(5000);
      const awbCode = await assignAWB(shipmentId);
      await requestPickup(shipmentId);
      await Order.findByIdAndUpdate(order._id, {
        shiprocketShipmentId: shipmentId,
        shiprocketStatus: "pickup_requested",
        awbCode,
        orderStatus: "processing",
      });
    })
    .catch(async (err) => {
      await Order.findByIdAndUpdate(order._id, { shiprocketStatus: "failed" });
      console.error(`❌ Shiprocket failed for COD orderId ${order._id}:`, err.message);
    });
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
    walletDeduction = 0,
  } = req.body;

  if (!razorpayOrderId) throw new ApiError(400, "razorpayOrderId is required!");
  if (!razorpayPaymentId)
    throw new ApiError(400, "razorpayPaymentId is required!");
  if (!razorpaySignature)
    throw new ApiError(400, "razorpaySignature is required!");
  if (!shippingAddress) throw new ApiError(400, "shippingAddress is required!");
  if (!orderItems?.length) throw new ApiError(400, "orderItems are required!");
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");
  if (expectedSignature !== razorpaySignature)
    throw new ApiError(400, "payment verification failed — invalid signature!");

  const { pincode } = shippingAddress;
  if (!pincode || !/^\d{6}$/.test(pincode))
    throw new ApiError(
      400,
      "valid 6-digit pincode is required in shipping address!"
    );

  try {
    const serviceabilityData = await checkServiceability(pincode);
    const couriers: any[] =
      serviceabilityData?.data?.available_courier_companies ?? [];
    if (couriers.length === 0)
      throw new ApiError(
        400,
        `delivery is not available at pincode ${pincode}.`
      );
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
    verifiedDiscount = { code: coupon.code, amount: recalculated };
  }

  const order = await Order.create({
    user: req.user._id,
    items: orderItems,
    shippingAddress,
    paymentMethod: "razorpay",
    paymentStatus: "paid",
    orderStatus: "placed",
    razorpayOrderId,
    razorpayPaymentId,
    baseAmount,
    totalAmount,
    shiprocketStatus: "pending",
    ...(verifiedDiscount ? { discount: verifiedDiscount } : {}),
    ...(walletDeduction > 0 ? { walletDeduction } : {}),
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
        user: req.user._id,
        order: order._id,
      });
      await Coupon.findByIdAndUpdate(coupon._id, { $inc: { usedCount: 1 } });
    }
  }

  if (walletDeduction > 0) {
    await User.findByIdAndUpdate(req.user._id, {
      $push: {
        wallet: {
          amount: walletDeduction,
          type: "debit",
          source: "order",
          source_id: order._id,
          description: `wallet redeemed on order`,
        },
      },
    });
  }

  const settings = await getSettings();
  if (settings.walletCashbackEnabled && settings.walletCashbackPercent > 0) {
    const cashback = Math.floor(
      (baseAmount * settings.walletCashbackPercent) / 100
    );
    if (cashback > 0) {
      await User.findByIdAndUpdate(req.user._id, {
        $push: {
          wallet: {
            amount: cashback,
            type: "credit",
            source: "cashback",
            source_id: order._id,
            description: `${settings.walletCashbackPercent}% cashback on order`,
          },
        },
      });
    }
  }

  res
    .status(201)
    .json(
      new ApiResponse(201, { orderId: order._id }, "order placed successfully!")
    );
    
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  createShiprocketOrder({
    orderId: order._id.toString(),
    orderDate: order.createdAt.toISOString(),
    shippingAddress,
    items: orderItems.map((item: any) => ({
      name: item.name,
      sizeLabel: item.sizeLabel,
      price: item.price,
      quantity: item.quantity,
    })),
    totalAmount,
    baseAmount,
  })
    .then(async (shipmentId) => {
      await sleep(5000);
      const awbCode = await assignAWB(shipmentId);
      await requestPickup(shipmentId);
      await Order.findByIdAndUpdate(order._id, {
        shiprocketShipmentId: shipmentId,
        shiprocketStatus: "pickup_requested",
        awbCode,
        orderStatus: "processing",
      });
    })
    .catch(async (err) => {
      await Order.findByIdAndUpdate(order._id, { shiprocketStatus: "failed" });
      console.error(
        `❌ Shiprocket failed for orderId ${order._id}:`,
        err.message
      );
    });
});

const initiateRazorpayRefund = async (
  paymentId: string,
  amountPaise: number
): Promise<string> => {
  const response = await fetch(
    `https://api.razorpay.com/v1/payments/${paymentId}/refund`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(
          `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`
        ).toString("base64")}`,
      },
      body: JSON.stringify({ amount: amountPaise }),
    }
  );
  const data = await response.json();
  if (!response.ok) {
    console.error("Razorpay refund failed:", data);
    throw new Error(data?.error?.description ?? "Razorpay refund failed");
  }
  return data.id;
};

const cancelShiprocketOrder = async (shipmentId: string): Promise<void> => {
  try {
    // get fresh token from your existing util
    const tokenRes = await fetch(
      "https://apiv2.shiprocket.in/v1/external/auth/login",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: process.env.SHIPROCKET_EMAIL,
          password: process.env.SHIPROCKET_PASSWORD,
        }),
      }
    );
    const tokenData = await tokenRes.json();
    const token = tokenData.token;

    await fetch("https://apiv2.shiprocket.in/v1/external/orders/cancel", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ ids: [shipmentId] }),
    });
  } catch (err: any) {
    // non-blocking — log but don't throw
    console.error("Shiprocket cancel failed (non-blocking):", err.message);
  }
};

export const cancelOrder = asyncHandler(async (req: Request, res: Response) => {
  const { orderId } = req.params;
  if (!orderId) throw new ApiError(400, "orderId is required.");

  const order = await Order.findOne({ _id: orderId, user: req.user._id });
  if (!order) throw new ApiError(404, "Order not found.");

  if (["shipped", "delivered", "cancelled"].includes(order.orderStatus)) {
    throw new ApiError(
      400,
      order.orderStatus === "cancelled"
        ? "Order is already cancelled."
        : "Order cannot be cancelled after it has been shipped."
    );
  }

  if (order.shiprocketShipmentId) {
    await cancelShiprocketOrder(order.shiprocketShipmentId);
  }

  let razorpayRefundId: string | null = null;
  if (order.razorpayPaymentId && order.totalAmount > 0) {
    try {
      razorpayRefundId = await initiateRazorpayRefund(
        order.razorpayPaymentId,
        order.totalAmount * 100 // paise
      );
    } catch (err: any) {
      console.warn("Refund processing warning:", err.message);
      // Continue with order cancellation even if refund fails
      // User can be refunded manually later
    }
  }

  // 4. Refund wallet deduction back to user's wallet
  // nah nah for now we will be directly transfering amount to user's bank account via the same method , it will be on the hands of razorpay
  // const walletDeduction = (order as any).walletDeduction ?? 0;
  // if (walletDeduction > 0) {
  //   await User.findByIdAndUpdate(req.user._id, {
  //     $push: {
  //       wallet: {
  //         amount: walletDeduction,
  //         type: "credit",
  //         source: "refund",
  //         source_id: order._id,
  //         description: `Wallet refund for cancelled order`,
  //       },
  //     },
  //   });
  // }

  // 5. Reverse cashback that was credited on this order
  // (debit it back so balance stays accurate)
  const settings = await getSettings();
  if (settings.walletCashbackEnabled && settings.walletCashbackPercent > 0) {
    const cashback = Math.floor(
      (order.baseAmount * settings.walletCashbackPercent) / 100
    );
    if (cashback > 0) {
      await User.findByIdAndUpdate(req.user._id, {
        $push: {
          wallet: {
            amount: cashback,
            type: "debit",
            source: "refund",
            source_id: order._id,
            description: `Cashback reversed for cancelled order`,
          },
        },
      });
    }
  }

  for (const item of order.items) {
    await Product.updateOne(
      { _id: item.product, "sizes.label": item.sizeLabel },
      { $inc: { "sizes.$.stock": item.quantity } }
    );
  }

  await Order.findByIdAndUpdate(order._id, {
    orderStatus: "cancelled",
    shiprocketStatus: "cancelled",
    ...(razorpayRefundId ? { razorpayRefundId } : {}),
  });

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { razorpayRefundId },
        "Order cancelled and refund initiated."
      )
    );
});

export const adminCancelOrder = asyncHandler(
  async (req: Request, res: Response) => {
    const { orderId } = req.params;
    if (!orderId) throw new ApiError(400, "orderId is required.");

    const order = await Order.findById(orderId);
    if (!order) throw new ApiError(404, "Order not found.");

    if (order.orderStatus === "cancelled")
      throw new ApiError(400, "Order is already cancelled.");

    // Admin can cancel even shipped orders (e.g. lost package)
    if (order.shiprocketShipmentId) {
      await cancelShiprocketOrder(order.shiprocketShipmentId);
    }

    let razorpayRefundId: string | null = null;
    if (order.razorpayPaymentId && order.totalAmount > 0) {
      try {
        razorpayRefundId = await initiateRazorpayRefund(
          order.razorpayPaymentId,
          order.totalAmount * 100
        );
      } catch (err: any) {
        console.warn("Refund processing warning:", err.message);
        // Continue with order cancellation even if refund fails
        // User can be refunded manually later
      }
    }

    const walletDeduction = (order as any).walletDeduction ?? 0;
    if (walletDeduction > 0) {
      await User.findByIdAndUpdate(order.user, {
        $push: {
          wallet: {
            amount: walletDeduction,
            type: "credit",
            source: "refund",
            source_id: order._id,
            description: `Wallet refund for admin-cancelled order`,
          },
        },
      });
    }

    // const settings = await getSettings();
    // if (settings.walletCashbackEnabled && settings.walletCashbackPercent > 0) {
    //   const cashback = Math.floor(
    //     (order.baseAmount * settings.walletCashbackPercent) / 100
    //   );
    //   if (cashback > 0) {
    //     await User.findByIdAndUpdate(order.user, {
    //       $push: {
    //         wallet: {
    //           amount: cashback,
    //           type: "debit",
    //           source: "refund",
    //           source_id: order._id,
    //           description: `Cashback reversed for admin-cancelled order`,
    //         },
    //       },
    //     });
    //   }
    // }

    for (const item of order.items) {
      await Product.updateOne(
        { _id: item.product, "sizes.label": item.sizeLabel },
        { $inc: { "sizes.$.stock": item.quantity } }
      );
    }

    await Order.findByIdAndUpdate(order._id, {
      orderStatus: "cancelled",
      shiprocketStatus: "cancelled",
      ...(razorpayRefundId ? { razorpayRefundId } : {}),
    });

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { razorpayRefundId },
          "Order cancelled and refund initiated."
        )
      );
  }
);

export {
  createOrder,
  createCodOrder,
  verifyAndSaveOrder,
  getOrder,
  getUserOrders,
  getAllOrders,
  getParticularOrder,
};
