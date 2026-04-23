import { Schema , model } from "mongoose";
import { IProduct, productDetails, sizeVariant } from "../interfaces/product.interface.ts";

const sizeVariantSchema = new Schema<sizeVariant>(
  {
    label: {
      type: String,
      required: true,
      enum: [
        "15ml",
        "30ml",
        "50ml",
        "100ml",
        "200ml",
        "15g",
        "30g",
        "50g",
        "100g",
        "200g",
      ],
    },
    unit: {
      type: String,
      required: true,
      enum: ["ml", "g"],
    },
    basePrice: {
      type: Number,
    },
    finalPrice: {
      type: Number,
      required: true,
    },
    stock: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps:false
   }
);

const productDetailsSchema = new Schema<productDetails>(
  {
    title: { type: String },
  },
  { timestamps: false }
);

const productSchema = new Schema<IProduct>(
  {
    title: { 
        type: String, 
        required: true 
    },
    category: { 
        type: String, 
        required: true 
    },
    description: { 
        type: String, 
        required: true 
    },
    image: [
      {
        url: {
          type: String,
        },
        public_id: {
          type: String,
          required: true,
        },
        isThumbnail: {
          type: Boolean,
          default: false,
        },
      },
    ],
    skinType: [
      {
        type: String,
        enum: ["oily", "dry", "combination", "sensitive", "normal"],
      },
    ],
    sizes: {
      type: [sizeVariantSchema], 
      required: true,
    },
    productDetails: {
      type: [productDetailsSchema],
    },
  },
  { timestamps: true }
);

export const Product = model<IProduct>("Product", productSchema);
