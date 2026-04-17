import bcryptjs from "bcryptjs";
import jwt  from "jsonwebtoken";


export const comparePassword = async( plain:string , hashed:string ):Promise<boolean> => {
    return await bcryptjs.compare(plain,hashed);
}

export const generateToken = ( payload:object , secret:string , expiry:string ): string => {
      return jwt.sign(
        payload,
        secret,
        {
          expiresIn: expiry as any,
        }
      );
} 