const express = require("express");
const router = express.Router();
const requireAuth = require("../middleware/requireAuth");
const {
  createTicket,
  getMyTickets,
  getTicketByNumber,
} = require("../controllers/ticketController");

router.use(requireAuth);

router.post("/", createTicket);
router.get("/", getMyTickets);
router.get("/:ticketNumber", getTicketByNumber);

module.exports = router;
