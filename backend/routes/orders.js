const express = require("express");
const router = express.Router();
const requireAuth = require("../middleware/requireAuth");
const {
  getMyOrders,
  getOrderById,
  cancelOrder,
  requestReturn,
  getRefundStatus,
} = require("../controllers/orderController");

// All order routes require a logged-in user
router.use(requireAuth);

router.get("/", getMyOrders);
router.get("/:id", getOrderById);
router.get("/:id/refund", getRefundStatus);
router.patch("/:id/cancel", cancelOrder);
router.patch("/:id/return", requestReturn);

module.exports = router;
