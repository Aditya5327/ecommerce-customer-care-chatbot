const mongoose = require("mongoose");

/**
 * Each order item snapshots product name + price at time of purchase,
 * so if the product price changes later, past orders stay accurate.
 */
const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    name: { type: String, required: true },
    price: { type: Number, required: true }, // price at time of order
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

/**
 * status is the key field the chatbot reads/writes for:
 *  - "track order"  -> GET status
 *  - "cancel order" -> set to "cancelled"
 *  - "return order" -> set to "return_requested" -> "returned"
 */
const orderSchema = new mongoose.Schema(
  {
    // Human-friendly 6-digit order number shown to customers (e.g. "583214").
    // The MongoDB _id still exists underneath for internal lookups, but
    // customers and the chatbot should always use this instead.
    orderNumber: {
      type: String,
      required: true,
      unique: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    items: {
      type: [orderItemSchema],
      required: true,
    },
    totalAmount: {
      type: Number,
      required: true,
    },
    shippingAddress: {
      line1: String,
      line2: String,
      city: String,
      state: String,
      postalCode: String,
      country: String,
    },
    status: {
      type: String,
      enum: [
        "pending",
        "confirmed",
        "shipped",
        "delivered",
        "cancelled",
        "return_requested",
        "returned",
      ],
      default: "pending",
    },
    returnReason: {
      type: String,
      default: null,
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "pending",
    },
    // Stored so we can issue a real Razorpay refund later if the order
    // is cancelled or returned.
    razorpayPaymentId: {
      type: String,
      default: null,
    },
    // Refund tracking - populated once a return/cancellation triggers a refund
    refund: {
      status: {
        type: String,
        enum: ["none", "initiated", "processing", "completed", "failed"],
        default: "none",
      },
      amount: { type: Number, default: 0 },
      razorpayRefundId: { type: String, default: null },
      initiatedAt: { type: Date, default: null },
      completedAt: { type: Date, default: null },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);
