const Ticket = require("../models/Ticket");
const Order = require("../models/Order");
const generateTicketNumber = require("../utils/generateTicketNumber");

// POST /api/tickets
// Body: { issue, orderNumber? }
const createTicket = async (req, res, next) => {
  try {
    const { issue, orderNumber } = req.body;

    if (!issue || !issue.trim()) {
      return res.status(400).json({ message: "Please describe the issue" });
    }

    let orderRef = null;
    if (orderNumber) {
      // Only link the ticket to the order if it actually belongs to this user
      const order = await Order.findOne({ orderNumber, user: req.user.id });
      if (order) orderRef = order._id;
    }

    const ticketNumber = await generateTicketNumber();

    const ticket = await Ticket.create({
      ticketNumber,
      user: req.user.id,
      order: orderRef,
      issue: issue.trim(),
    });

    res.status(201).json({ message: "Ticket created", ticket });
  } catch (err) {
    next(err);
  }
};

// GET /api/tickets - all of the logged-in user's tickets
const getMyTickets = async (req, res, next) => {
  try {
    const tickets = await Ticket.find({ user: req.user.id }).sort({ createdAt: -1 });
    res.json(tickets);
  } catch (err) {
    next(err);
  }
};

// GET /api/tickets/:ticketNumber
const getTicketByNumber = async (req, res, next) => {
  try {
    const ticket = await Ticket.findOne({ ticketNumber: req.params.ticketNumber });
    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }
    if (ticket.user.toString() !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ message: "Not authorized to view this ticket" });
    }
    res.json(ticket);
  } catch (err) {
    next(err);
  }
};

module.exports = { createTicket, getMyTickets, getTicketByNumber };
