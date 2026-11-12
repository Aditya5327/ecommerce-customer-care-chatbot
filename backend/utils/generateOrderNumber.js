const Order = require("../models/Order");

/**
 * Generates a random 6-digit order number (100000-999999) and verifies
 * it isn't already in use. Collisions are extremely unlikely at this
 * scale, but we check anyway since these numbers are customer-facing
 * and must be unique.
 */
async function generateOrderNumber() {
  let orderNumber;
  let exists = true;

  while (exists) {
    orderNumber = String(Math.floor(100000 + Math.random() * 900000));
    exists = await Order.exists({ orderNumber });
  }

  return orderNumber;
}

module.exports = generateOrderNumber;
