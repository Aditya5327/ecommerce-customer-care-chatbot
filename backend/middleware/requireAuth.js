const jwt = require("jsonwebtoken");

/**
 * Protects routes that require login.
 * Expects header: Authorization: Bearer <token>
 * On success, attaches decoded user info to req.user (e.g. req.user.id)
 *
 * This is also what the chatbot service will need to hit when it acts
 * on behalf of a logged-in user - the frontend passes the user's token
 * along with chat messages, Node verifies it before letting the bot
 * touch that user's orders.
 */
const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "No token provided" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id: userId, iat, exp }
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

module.exports = requireAuth;
