// const mongoose = require("mongoose");

// const connectDB = async () => {
//   try {
//     const conn = await mongoose.connect(process.env.MONGO_URI);
//     console.log(`MongoDB connected: ${conn.connection.host}`);
//   } catch (err) {
//     console.error(`MongoDB connection error: ${err.message}`);
//     process.exit(1); // stop the server if DB connection fails
//   }
// };

// module.exports = connectDB;


const mongoose = require("mongoose");
const dns = require("dns");

// Force Node's own DNS lookups to use Google's DNS servers, regardless of
// what the OS network settings say. This works around a known recurring
// issue where Node.js on Windows fails to resolve MongoDB Atlas's SRV
// record (querySrv ECONNREFUSED) even when normal browsing/DNS works fine
// and the OS-level DNS has already been changed.
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB connected: ${conn.connection.host}`);
  } catch (err) {
    console.error(`MongoDB connection error: ${err.message}`);
    process.exit(1); // stop the server if DB connection fails
  }
};

module.exports = connectDB;