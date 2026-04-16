import mongoose from "mongoose";

const sizeVariantSchema = new mongoose.Schema(
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
  { _id: false }
);

const productDetailsSchema = new mongoose.Schema(
  {
    title: { type: String },
  },
  { timestamps: true }
);

const productSchema = new mongoose.Schema(
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
    image: {
      url: { 
        type: String, 
        required: true 
    },
      public_id: { 
        type: String, 
        required: true 
    },
    },
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

export const Product = mongoose.model("Product", productSchema);
