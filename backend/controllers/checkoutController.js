const crypto = require("crypto");
const razorpay = require("../config/razorpay");
const Product = require("../models/Product");
const Order = require("../models/Order");
const Cart = require("../models/Cart");
const generateOrderNumber = require("../utils/generateOrderNumber");

/**
 * POST /api/checkout/create-order
 * Body: { items: [{ productId, quantity }], shippingAddress: {...} }
 *
 * IMPORTANT: We recalculate the total price on the server using real
 * product prices from MongoDB - we never trust a price sent from the
 * frontend, since that could be tampered with in the browser.
 */
const createRazorpayOrder = async (req, res, next) => {
  try {
    let { items, shippingAddress } = req.body;

    // If no items were explicitly passed, fall back to the user's server-side
    // cart. This is what lets the chatbot say "checkout" without needing to
    // resend the whole cart itself - it just triggers checkout on whatever
    // is already in the real cart.
    if (!items || !items.length) {
      const cart = await Cart.findOne({ user: req.user.id });
      if (cart && cart.items.length) {
        items = cart.items.map((i) => ({ productId: i.product, quantity: i.quantity }));
      }
    }

    if (!items || !items.length) {
      return res.status(400).json({ message: "Cart is empty" });
    }

    // Look up real products and validate stock + calculate real total
    let totalAmount = 0;
    const orderItems = [];

    for (const cartItem of items) {
      const product = await Product.findById(cartItem.productId);
      if (!product || !product.isActive) {
        return res
          .status(400)
          .json({ message: `Product ${cartItem.productId} not found` });
      }
      if (product.stock < cartItem.quantity) {
        return res.status(400).json({
          message: `Not enough stock for ${product.name}. Only ${product.stock} left.`,
        });
      }

      totalAmount += product.price * cartItem.quantity;
      orderItems.push({
        product: product._id,
        name: product.name,
        price: product.price,
        quantity: cartItem.quantity,
      });
    }

    // Razorpay expects amount in paise (smallest currency unit), so multiply by 100
    const razorpayOrder = await razorpay.orders.create({
      amount: Math.round(totalAmount * 100),
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
    });

    // Send back what the frontend needs to open the Razorpay checkout widget.
    // We also send orderItems + shippingAddress back so the frontend can
    // pass them along unchanged to the verify step (avoids re-sending cart
    // and re-trusting it - server already validated it once here).
    res.json({
      razorpayOrderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
      orderItems,
      totalAmount,
      shippingAddress,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/checkout/verify
 * Body: {
 *   razorpay_order_id, razorpay_payment_id, razorpay_signature,
 *   orderItems, totalAmount, shippingAddress
 * }
 *
 * This verifies the payment actually happened and wasn't faked, THEN
 * creates the real Order in MongoDB and decrements stock.
 */
const verifyPayment = async (req, res, next) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      orderItems,
      totalAmount,
      shippingAddress,
    } = req.body;

    if (
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature ||
      !orderItems
    ) {
      return res.status(400).json({ message: "Missing payment verification fields" });
    }

    // Recreate the expected signature using our secret key and compare.
    // This is what proves the payment is real and untampered with -
    // never skip this check.
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ message: "Payment verification failed" });
    }

    // Payment confirmed genuine - now create the real order and reduce stock
    const orderNumber = await generateOrderNumber();

    const order = await Order.create({
      orderNumber,
      user: req.user.id,
      items: orderItems,
      totalAmount,
      shippingAddress,
      status: "confirmed",
      paymentStatus: "paid",
      razorpayPaymentId: razorpay_payment_id,
    });

    for (const item of orderItems) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { stock: -item.quantity },
      });
    }

    // Clear the server-side cart now that the order is placed
    await Cart.findOneAndUpdate({ user: req.user.id }, { items: [] });

    res.status(201).json({ message: "Payment verified, order placed", order });
  } catch (err) {
    next(err);
  }
};

module.exports = { createRazorpayOrder, verifyPayment };
