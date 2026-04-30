
import { Shipping } from "../models/shipping.settings.model.ts";
import { IShipping } from "../interfaces/shipping.settings.interface.ts";
 
let _cached:  IShipping | null = null;
let _expiry:  number           = 0;
const TTL = 5 * 60 * 1000; 
 
export const getShippingConfig = async (): Promise<IShipping> => {
  if (_cached && Date.now() < _expiry) return _cached;
 
  let config = await Shipping.findOne({ isActive: true });
 
  if (!config) {
    config = await Shipping.create({
      freeShippingEnabled:   false,
      freeShippingThreshold: 499,
      defaultShippingCost:   99,
      isActive:              true,
    });
  }
 
  _cached = config;
  _expiry = Date.now() + TTL;
  return config;
};
 
export const invalidateShippingCache = () => {
  _cached = null;
  _expiry = 0;
};
 
export const calculateShippingCost = (
  config: IShipping,
  cartAmount: number
): number => {
  if (config.freeShippingEnabled) return 0;
  if (cartAmount >= config.freeShippingThreshold) return 0;
  return config.defaultShippingCost;
};
 
