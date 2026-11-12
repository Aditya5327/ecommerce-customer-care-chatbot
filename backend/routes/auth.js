const express = require("express");
const router = express.Router();
// const { register, login, getMe } = require("../controllers/authController");
const { register, login, getMe, changePassword,} = require("../controllers/authController");
const requireAuth = require("../middleware/requireAuth");

router.put("/change-password", requireAuth, changePassword);
router.post("/register", register);
router.post("/login", login);
router.get("/me", requireAuth, getMe); // protected - needs valid token

module.exports = router;
