require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const errorHandler = require("./middleware/errorHandler");

// Routes
const productRoutes = require("./routes/products");
const authRoutes = require("./routes/auth");
const orderRoutes = require("./routes/orders");
const checkoutRoutes = require("./routes/checkout");
const cartRoutes = require("./routes/cart");
const ticketRoutes = require("./routes/tickets");
// const chatbotRoutes = require("./routes/chatbot");  // Phase 4

const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get("/", (req, res) => {
  res.json({ message: "Ecommerce Electronics API is running" });
});

// Mount routes
app.use("/api/products", productRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/checkout", checkoutRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/tickets", ticketRoutes);
// app.use("/api/chatbot", chatbotRoutes);

// Error handler (must be last)
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
