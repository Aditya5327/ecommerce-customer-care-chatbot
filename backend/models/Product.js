const mongoose = require("mongoose");

/**
 * Flexible product schema for electronics.
 * Common fields apply to every product (name, price, stock, images).
 * The `specs` object holds category-specific fields so we don't need
 * a separate schema per product type:
 *   - laptop:     { ram: "16GB", cpu: "Intel i7", storage: "512GB SSD" }
 *   - mouse:      { dpi: 16000, wireless: true, buttons: 6 }
 *   - keyboard:   { switchType: "Mechanical Blue", layout: "TKL" }
 *   - headphones: { driverSize: "40mm", noiseCancelling: true, wireless: true }
 *
 * NOTE: Update this once we have your real CSV field names -
 * this is a reasonable default, not final.
 */
const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
    category: {
      type: String,
      required: true,
      enum: ["laptop", "mouse", "keyboard", "headphones", "other"],
      lowercase: true,
    },
    brand: {
      type: String,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    stock: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    images: {
      type: [String], // array of image URLs
      default: [],
    },
    specs: {
      type: mongoose.Schema.Types.Mixed, // flexible key-value pairs per category
      default: {},
    },
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    isActive: {
      type: Boolean,
      default: true, // lets us "soft delete" / hide products without removing them
    },
  },
  { timestamps: true }
);

// Index for filtering/search performance
productSchema.index({ category: 1 });
productSchema.index({ name: "text", description: "text" });

module.exports = mongoose.model("Product", productSchema);
