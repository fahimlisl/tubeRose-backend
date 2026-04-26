import { ShiprocketOrderPayload } from "../interfaces/global.interface.ts";

let cachedToken: string | null = null;
let tokenExpiry: number        = 0;

const getShiprocketToken = async (): Promise<string> => {
    if (cachedToken && Date.now() < tokenExpiry) {
        return cachedToken;
    }
    const res = await fetch("https://apiv2.shiprocket.in/v1/external/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            email:    process.env.SHIPROCKET_EMAIL,
            password: process.env.SHIPROCKET_PASSWORD,
        }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error("Failed to authenticate with Shiprocket");
    cachedToken = data.token;
    tokenExpiry = Date.now() + 23 * 60 * 60 * 1000;
    return cachedToken as string;
};

export const checkServiceability = async (pincode: string) => {
    const token = await getShiprocketToken();
    const res = await fetch(
        `https://apiv2.shiprocket.in/v1/external/courier/serviceability/?pickup_postcode=${process.env.WAREHOUSE_PINCODE}&delivery_postcode=${pincode}&weight=0.5&cod=0`,
        {
            headers: {
                "Content-Type":  "application/json",
                "Authorization": `Bearer ${token}`,
            },
        }
    );
    const data = await res.json();
    if (!res.ok) throw new Error("Shiprocket serviceability check failed");
    return data;
};
export const createShiprocketOrder = async (payload: ShiprocketOrderPayload): Promise<string> => {
    const token = await getShiprocketToken();
    const addressParts = [
        payload.shippingAddress.houseNo,
        payload.shippingAddress.addressLine1,
        payload.shippingAddress.addressLine2,
    ].filter(Boolean).join(", ");

    const orderItems = payload.items.map((item, index) => ({
        name:          `${item.name} (${item.sizeLabel})`,
        sku:           `SKU-${index + 1}`,       
        units:         item.quantity,
        selling_price: item.price,
        discount:      "",
        tax:           "",
        hsn:           "",
    }));

    const body = {
        order_id:          payload.orderId,  
        order_date:        payload.orderDate,
        pickup_location:   "Fahim ",        
        channel_id:        "",           
        billing_customer_name:  payload.shippingAddress.fullName,
        billing_last_name:      "",
        billing_address:        addressParts,
        billing_address_2:      payload.shippingAddress.addressLine2 ?? "",
        billing_city:           payload.shippingAddress.city,
        billing_pincode:        payload.shippingAddress.pincode,
        billing_state:          payload.shippingAddress.state,
        billing_country:        "India",
        billing_email:          "",           // optional
        billing_phone:          payload.shippingAddress.phone,
        shipping_is_billing:    true,         // same as billing
        order_items:            orderItems,
        payment_method:         "Prepaid",    // always prepaid since Razorpay already paid
        sub_total:              payload.baseAmount,
        length:                 10,           // cm — update with actual product dims
        breadth:                10,
        height:                 10,
        weight:                 0.5,          // kg — update per product
    };

    const res = await fetch(
        "https://apiv2.shiprocket.in/v1/external/orders/create/adhoc",
        {
            method: "POST",
            headers: {
                "Content-Type":  "application/json",
                "Authorization": `Bearer ${token}`,
            },
            body: JSON.stringify(body),
        }
    );

    const data = await res.json();

    if (!res.ok) {
        console.error("Shiprocket order creation failed:", JSON.stringify(data));
        throw new Error(data?.message ?? "Shiprocket order creation failed");
    }
    return data.shipment_id?.toString() ?? "";  // shiprocket's shipment_id
};

export const assignAWB = async (shipmentId: string): Promise<string> => {
    const token = await getShiprocketToken();

    const courierRes = await fetch(
        `https://apiv2.shiprocket.in/v1/external/courier/courierListWithCounts?shipment_id=${shipmentId}`,
        {
            headers: {
                "Content-Type":  "application/json",
                "Authorization": `Bearer ${token}`,
            },
        }
    );

    const courierData = await courierRes.json();
    if (!courierRes.ok) throw new Error("Failed to fetch courier list");

    const couriers: any[] = courierData?.courier_data ?? [];
    if (couriers.length === 0) throw new Error("No couriers available for this shipment");

    const fastest = couriers.find(c => c.status === 1) ?? couriers[0];
    // will be using for production

    //   const bestCourier = couriers.find(
    //   c => c.status === 1 && c.is_hyperlocal === 0
    // ) ?? couriers[0];

    const courierId = fastest?.id;
    if (!courierId) throw new Error("Could not determine courier");

    const awbRes = await fetch(
        "https://apiv2.shiprocket.in/v1/external/courier/assign/awb",
        {
            method: "POST",
            headers: {
                "Content-Type":  "application/json",
                "Authorization": `Bearer ${token}`,
            },
            body: JSON.stringify({
                shipment_id:  shipmentId,
                courier_id:   courierId.toString(),
            }),
        }
    );

    const awbData = await awbRes.json();
    if (!awbRes.ok) {
        console.error("AWB assignment failed:", awbData);
        throw new Error(awbData?.message ?? "AWB assignment failed");
    }

    const awbCode = awbData?.response?.data?.awb_code;
    if (!awbCode) throw new Error("AWB code not returned by Shiprocket");

    return awbCode;
}; 

export const requestPickup = async (shipmentId: string): Promise<void> => {
    const token = await getShiprocketToken();

    const res = await fetch(
        "https://apiv2.shiprocket.in/v1/external/courier/generate/pickup",
        {
            method: "POST",
            headers: {
                "Content-Type":  "application/json",
                "Authorization": `Bearer ${token}`,
            },
            body: JSON.stringify({
                shipment_id: [shipmentId], 
            }),
        }
    );

    const data = await res.json();
    if (!res.ok) {
        console.error("Pickup request failed:", data);
        throw new Error(data?.message ?? "Pickup request failed");
    }
};