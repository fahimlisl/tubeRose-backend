import { Request, Response } from "express";
import { Order } from "../models/order.model.ts";

const mapShiprocketStatus = (
  srStatusLabel: string
): "processing" | "shipped" | "delivered" | "cancelled" | null => {
  const s = srStatusLabel.toUpperCase().trim();

  if (s === "DELIVERED")                    return "delivered";

  if (
    s.includes("RTO") ||
    s.includes("LOST") ||
    s.includes("CANCELLED") ||
    s.includes("DESTROYED") ||
    s === "NOT SERVICEABLE"
  )                                         return "cancelled";

  if (
    s === "IN TRANSIT" ||
    s === "SHIPPED" ||
    s === "OUT FOR DELIVERY" ||
    s === "REACHED DESTINATION HUB"
  )                                         return "shipped";

  if (
    s === "PICKED UP" ||
    s === "PICKUP SCHEDULED" ||
    s === "PICKUP GENERATED" ||
    s === "PICKUP QUEUED" ||
    s === "MANIFEST GENERATED" ||
    s === "OUT FOR PICKUP"
  )                                         return "processing";

  return null;
};

const statusRank: Record<string, number> = {
  placed:     0,
  processing: 1,
  shipped:    2,
  delivered:  3,
  cancelled:  99,
};

export const shiprocketWebhook = async (
  req: Request,
  res: Response
): Promise<void> => {
  res.status(200).json({ received: true });

  try {
    const incomingKey = req.headers["x-api-key"] as string;
    if (
      process.env.SHIPROCKET_WEBHOOK_SECRET &&
      incomingKey !== process.env.SHIPROCKET_WEBHOOK_SECRET
    ) {
      console.warn("⚠️  Shiprocket webhook: invalid x-api-key, ignoring.");
      return;
    }

    const payload = req.body;

    const events: any[] = Array.isArray(payload) ? payload : [payload];

    for (const event of events) {
      const awbCode: string = event?.awb ?? "";

      if (!awbCode) {
        console.warn("⚠️  Shiprocket webhook: missing awb, skipping.", event);
        continue;
      }

      const scans: any[] = event?.scans ?? [];
      let srStatusLabel: string =
        scans.length > 0
          ? (scans[scans.length - 1]?.["sr-status-label"] ?? "")
          : (event?.current_status ?? "");

      if (!srStatusLabel || srStatusLabel === "NA") {
        for (let i = scans.length - 1; i >= 0; i--) {
          const label = scans[i]?.["sr-status-label"];
          if (label && label !== "NA") {
            srStatusLabel = label;
            break;
          }
        }
      }

      if (!srStatusLabel) {
        console.warn(`⚠️  Shiprocket webhook: no usable status for AWB ${awbCode}`);
        continue;
      }

      const newOrderStatus = mapShiprocketStatus(srStatusLabel);

      if (!newOrderStatus) {
        console.log(
          `ℹ️  Shiprocket webhook: unrecognised status "${srStatusLabel}" for AWB ${awbCode} — skipping`
        );
        continue;
      }

      // 4. Find order by AWB
      const order = await Order.findOne({ awbCode });

      if (!order) {
        console.warn(`⚠️  Shiprocket webhook: no order for AWB ${awbCode}`);
        continue;
      }

      const currentRank = statusRank[order.orderStatus] ?? 0;
      const incomingRank = statusRank[newOrderStatus] ?? 0;

      if (newOrderStatus !== "cancelled" && incomingRank <= currentRank) {
        console.log(
          `ℹ️  Shiprocket webhook: order ${order._id} already at "${order.orderStatus}" — skipping "${newOrderStatus}"`
        );
        continue;
      }

      await Order.findByIdAndUpdate(order._id, {
        orderStatus: newOrderStatus,
        shiprocketStatus: srStatusLabel.toLowerCase().replace(/\s+/g, "_"),
      });

      console.log(
        `✅ Shiprocket webhook: order ${order._id} (AWB: ${awbCode}) ` +
        `"${order.orderStatus}" → "${newOrderStatus}" [${srStatusLabel}]`
      );
    }
  } catch (err: any) {
    console.error("❌ Shiprocket webhook internal error:", err.message);
  }
};