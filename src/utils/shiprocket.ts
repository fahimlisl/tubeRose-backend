let cachedToken: string | null = null;
let tokenExpiry: number        = 0;

const getShiprocketToken = async (): Promise<string> => {
    // return cached token if still valid
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
    tokenExpiry = Date.now() + 23 * 60 * 60 * 1000; // cache for 23hrs
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