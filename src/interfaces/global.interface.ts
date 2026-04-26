export interface JwtPayload {
    role : "admin" | "user";
    _id:string;
}

export interface OTPTokenPayload {
  otphash: string;
  phoneNumber: string; // req.body recives it as string
}

export interface PhoneNumberTokenPayload {
  phoneNumber:string
}

export interface ShiprocketOrderPayload {
    orderId:         string; 
    orderDate:       string;   
    shippingAddress: {
        fullName:     string;
        phone:        string;
        houseNo?:     string;
        addressLine1: string;
        addressLine2?: string;
        city:         string;
        state:        string;
        pincode:      string;
    };
    items: {
        name:      string;
        sizeLabel: string;
        price:     number;
        quantity:  number;
    }[];
    totalAmount: number;
    baseAmount:  number;
}