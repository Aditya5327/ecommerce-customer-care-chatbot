const mongoose = require("mongoose");

/**
 * One cart document per user (upserted, never duplicated).
 * Snapshotting name/price here would go stale, so instead we just store
 * productId + quantity and always look up live price/stock/name at
 * read time - that way the cart never shows outdated prices.
 */
const cartItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const cartSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true, // one cart per user
    },
    items: {
      type: [cartItemSchema],
      default: [],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Cart", cartSchema);
