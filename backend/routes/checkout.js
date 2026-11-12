const express = require("express");
const router = express.Router();
const requireAuth = require("../middleware/requireAuth");
const {
  createRazorpayOrder,
  verifyPayment,
} = require("../controllers/checkoutController");

router.use(requireAuth);

router.post("/create-order", createRazorpayOrder);
router.post("/verify", verifyPayment);

module.exports = router;
