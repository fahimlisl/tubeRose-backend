interface JwtPayload {
    role : "admin" | "user";
    _id:string;
}

interface OTPTokenPayload {
  otphash: string;
  phoneNumber: string; // req.body recives it as string
}

interface PhoneNumberTokenPayload {
  phoneNumber:string
}