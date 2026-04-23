import { ApiError } from "../utils/ApiError.js";
import { Request, Response, NextFunction } from "express";

export const isAdmin = (req: Request, _: Response, next: NextFunction) => {
  if (req.role !== "admin") {
    throw new ApiError(403, "Admin access only");
  }
  next();
};