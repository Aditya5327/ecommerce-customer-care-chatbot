const mongoose = require("mongoose");
const Order = require("../models/Order");
const Product = require("../models/Product");
const razorpay = require("../config/razorpay");

// GET /api/orders - logged-in user's own orders
const getMyOrders = async (req, res, next) => {
  try {
    const orders = await Order.find({ user: req.user.id }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    next(err);
  }
};

/**
 * Shared lookup: accepts either a MongoDB _id (used by the existing
 * frontend) or a 6-digit orderNumber (used by the chatbot / anywhere
 * customer-facing). Returns null if not found or not owned by the user
 * (unless they're an admin).
 */
async function findAuthorizedOrder(idOrNumber, requestingUser) {
  let order = null;

  if (mongoose.Types.ObjectId.isValid(idOrNumber)) {
    order = await Order.findById(idOrNumber);
  }
  if (!order) {
    order = await Order.findOne({ orderNumber: idOrNumber });
  }
  if (!order) return { order: null, authorized: false };

  const authorized =
    order.user.toString() === requestingUser.id || requestingUser.role === "admin";

  return { order, authorized };
}

/**
 * Attempts a Razorpay refund for a cancelled/returned order. Non-fatal:
 * if this fails (e.g. test mode quirks, network issue), we still let
 * the cancellation/return go through and just leave refund.status as
 * "failed" so it can be retried/handled manually rather than blocking
 * the customer-facing action.
 */
async function initiateRefund(order) {
  if (!order.razorpayPaymentId) {
    // No payment ID stored (e.g. very old test orders) - nothing to refund
    return;
  }

  try {
    const refund = await razorpay.payments.refund(order.razorpayPaymentId, {
      amount: Math.round(order.totalAmount * 100), // paise, full refund
    });

    order.refund = {
      status: "initiated",
      amount: order.totalAmount,
      razorpayRefundId: refund.id,
      initiatedAt: new Date(),
      completedAt: null,
    };
    order.paymentStatus = "refunded";
  } catch (err) {
    console.error("Refund initiation failed:", err.message);
    order.refund = {
      status: "failed",
      amount: order.totalAmount,
      razorpayRefundId: null,
      initiatedAt: new Date(),
      completedAt: null,
    };
  }
}

// GET /api/orders/:id
const getOrderById = async (req, res, next) => {
  try {
    const { order, authorized } = await findAuthorizedOrder(req.params.id, req.user);
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (!authorized) return res.status(403).json({ message: "Not authorized to view this order" });
    res.json(order);
  } catch (err) {
    next(err);
  }
};

// PATCH /api/orders/:id/cancel
const cancelOrder = async (req, res, next) => {
  try {
    const { order, authorized } = await findAuthorizedOrder(req.params.id, req.user);
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (!authorized) return res.status(403).json({ message: "Not authorized to cancel this order" });

    if (!["pending", "confirmed"].includes(order.status)) {
      return res.status(400).json({
        message: `Order cannot be cancelled once it is '${order.status}'`,
      });
    }

    order.status = "cancelled";

    if (order.paymentStatus === "paid") {
      await initiateRefund(order);
    }

    await order.save();

    // Restock the items since the order never shipped
    for (const item of order.items) {
      await Product.findByIdAndUpdate(item.product, { $inc: { stock: item.quantity } });
    }

    res.json({ message: "Order cancelled", order });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/orders/:id/return
// Body: { reason }
const requestReturn = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const { order, authorized } = await findAuthorizedOrder(req.params.id, req.user);
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (!authorized) return res.status(403).json({ message: "Not authorized for this order" });

    if (order.status !== "delivered") {
      return res.status(400).json({ message: "Only delivered orders can be returned" });
    }

    order.status = "return_requested";
    if (reason) order.returnReason = reason;

    await order.save();

    res.json({ message: "Return requested", order });
  } catch (err) {
    next(err);
  }
};

// GET /api/orders/:id/refund - refund status for an order
const getRefundStatus = async (req, res, next) => {
  try {
    const { order, authorized } = await findAuthorizedOrder(req.params.id, req.user);
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (!authorized) return res.status(403).json({ message: "Not authorized for this order" });

    res.json({
      orderNumber: order.orderNumber,
      paymentStatus: order.paymentStatus,
      refund: order.refund,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getMyOrders,
  getOrderById,
  cancelOrder,
  requestReturn,
  getRefundStatus,
  findAuthorizedOrder,
};
