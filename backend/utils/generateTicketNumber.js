const crypto = require("crypto");
const Ticket = require("../models/Ticket");

/**
 * Generates a ticket number like "TCK-A1B2C3D4" and checks uniqueness.
 */
async function generateTicketNumber() {
  let ticketNumber;
  let exists = true;

  while (exists) {
    const suffix = crypto.randomBytes(4).toString("hex").toUpperCase();
    ticketNumber = `TCK-${suffix}`;
    exists = await Ticket.exists({ ticketNumber });
  }

  return ticketNumber;
}

module.exports = generateTicketNumber;
