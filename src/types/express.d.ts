import { Admin } from "../models/admin.model";

declare global {
  namespace Express {
    interface Request {
      user?: typeof Admin.prototype;
      role?: "admin" | "user";
    }
  }
}