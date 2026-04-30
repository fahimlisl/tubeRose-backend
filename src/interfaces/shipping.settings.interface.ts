import { Document } from "mongoose";

export interface IShipping extends Document {
  freeShippingThreshold: number;
  freeShippingEnabled:   boolean;
  defaultShippingCost:   number;   
  isActive:              boolean;  
  updatedBy?:            string;  
}