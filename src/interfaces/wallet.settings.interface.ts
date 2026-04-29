import { Document } from "mongoose";

export interface IWalletSettings extends Document {
    walletCashbackEnabled: boolean;
    walletCashbackPercent: number;
    walletSpendingEnabled:boolean
    walletSpendingMaxPercent:number;
    walletSpendingMaxFixedCap:number;
    referralBonusEnabled:boolean;
    referralBonusAmount:number
}