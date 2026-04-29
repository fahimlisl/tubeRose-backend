import { Schema , model } from "mongoose";
import { IWalletSettings } from "../interfaces/wallet.settings.interface";

const walletSettingsSchema = new Schema<IWalletSettings>({
  
  // wallet earning  
  walletCashbackEnabled:  { type: Boolean, default: false },
  walletCashbackPercent:  { type: Number,  default: 0 },   

  //  wallet spending 
  walletSpendingEnabled:       { type: Boolean, default: true },
  walletSpendingMaxPercent:    { type: Number,  default: 0 }, 
  walletSpendingMaxFixedCap:   { type: Number,  default: 100 },  

  // referral
  referralBonusEnabled: { type: Boolean, default: true },
  referralBonusAmount:  { type: Number,  default: 200 },  
  // i do need it here , gotta change the hardcore settings later of register user thing ,

}, { timestamps: true });

export const WalletSettings = model<IWalletSettings>("WalletSettings", walletSettingsSchema);