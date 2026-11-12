const mongoose = require("mongoose");

const ticketSchema = new mongoose.Schema(
  {
    // Human-friendly ticket ID shown to customers, e.g. "TCK-A1B2C3D4"
    ticketNumber: {
      type: String,
      required: true,
      unique: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null, // tickets can exist without being tied to a specific order
    },
    issue: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["open", "in_progress", "resolved", "closed"],
      default: "open",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Ticket", ticketSchema);
