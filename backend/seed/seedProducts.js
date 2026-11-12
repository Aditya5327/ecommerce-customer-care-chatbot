/**
 * Seeds MongoDB with product data.
 *
 * USAGE:
 *   npm run seed
 *
 * By default this loads from ./seed/products.csv if it exists.
 * If no CSV is found, it falls back to sample dummy data below so
 * you can test the pipeline right away.
 *
 * NOTE: Once you share your real CSV, update the `mapRowToProduct`
 * function below to match your actual column names.
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const Product = require("../models/Product");

const CSV_PATH = path.join(__dirname, "products.csv");

// Sample fallback data - covers each category so the site isn't empty
const sampleProducts = [
  // ===== LAPTOPS (8) =====
  {
    name: "AeroBook Pro 15",
    description: "A lightweight 15-inch laptop built for everyday work and play. Balances solid performance with a slim, travel-friendly design, making it a dependable daily driver for students and professionals alike.",
    category: "laptop",
    brand: "AeroTech",
    price: 74999,
    stock: 12,
    images: [
      "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=1000&q=90"
    ],
    specs: { ram: "16GB", cpu: "Intel i7-1260P", storage: "512GB SSD", display: "15.6\" FHD" },
  },
  {
    name: "NovaBook Air 14",
    description: "An ultra-portable 14-inch laptop with all-day battery life. Ideal for anyone who's constantly on the move and wants a machine light enough to forget it's in the bag, without sacrificing screen size.",
    category: "laptop",
    brand: "NovaTech",
    price: 62999,
    stock: 18,
    images: [
      "https://images.unsplash.com/photo-1525547719571-a2d4ac8945e2?auto=format&fit=crop&w=1000&q=90"
    ],
    specs: { ram: "8GB", cpu: "Intel i5-1240P", storage: "256GB SSD", display: "14\" FHD" },
  },
  {
    name: "TitanForce Gaming Laptop",
    description: "A high-performance gaming laptop with a dedicated GPU and a high refresh-rate display. Built for competitive play and heavy workloads like video editing or 3D rendering, with cooling designed for long sessions.",
    category: "laptop",
    brand: "TitanForce",
    price: 129999,
    stock: 6,
    images: [
      "https://images.unsplash.com/photo-1593642632823-8f785ba67e45?auto=format&fit=crop&w=1000&q=90"
    ],
    specs: { ram: "32GB", cpu: "AMD Ryzen 9 7940HS", storage: "1TB SSD", gpu: "RTX 4070", display: "16\" QHD 165Hz" },
  },
  {
    name: "WorkHorse Business 14",
    description: "A no-nonsense business laptop built around reliability and security. Includes a fingerprint reader and a spill-resistant keyboard, aimed at professionals who need a machine that just works, day after day.",
    category: "laptop",
    brand: "WorkHorse",
    price: 58999,
    stock: 22,
    images: [
      "https://images.unsplash.com/photo-1541807084-5c52b6b3adef?auto=format&fit=crop&w=1000&q=90"
    ],

    specs: { ram: "16GB", cpu: "Intel i5-1335U", storage: "512GB SSD", display: "14\" FHD", security: "Fingerprint reader" },
  },
  {
    name: "UltraSlim Z13",
    description: "A fanless, ultra-thin 13-inch laptop for people who value silence and portability above all else. Runs cool and quiet even under sustained use, with a battery that comfortably lasts a full day away from a charger.",
    category: "laptop",
    brand: "UltraSlim",
    price: 84999,
    stock: 10,
    images: [
      "https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?auto=format&fit=crop&w=1000&q=90"
    ],
    specs: { ram: "16GB", cpu: "Intel i7-1355U", storage: "512GB SSD", display: "13.3\" 2.8K", weight: "990g" },
  },
  {
    name: "CreatorStation 16",
    description: "A 16-inch laptop built for content creators, with a color-accurate display and a discrete GPU for editing photos and video without waiting around for renders. Comes with a full-size SD card reader built in.",
    category: "laptop",
    brand: "CreatorStation",
    price: 149999,
    stock: 5,
    images: [
      "https://images.unsplash.com/photo-1593642702821-c8da6771f0c6?auto=format&fit=crop&w=1000&q=90"
    ],
    specs: { ram: "32GB", cpu: "Intel i9-13900H", storage: "1TB SSD", gpu: "RTX 4060", display: "16\" 4K color-accurate" },
  },
  {
    name: "BudgetBook Lite 15",
    description: "An affordable everyday laptop for browsing, documents, and video calls. Not built for heavy workloads, but a solid, honest choice for anyone who needs a reliable second machine without spending a lot.",
    category: "laptop",
    brand: "BudgetBook",
    price: 34999,
    stock: 30,
    images: [
      "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=1000&q=90"
    ],
    specs: { ram: "8GB", cpu: "Intel i3-1215U", storage: "256GB SSD", display: "15.6\" HD" },
  },
  {
    name: "Convertible Flex 14",
    description: "A 2-in-1 touchscreen laptop that folds flat into tablet mode. The included stylus makes it a natural fit for note-taking and light sketching, on top of handling regular laptop duties just fine.",
    category: "laptop",
    brand: "FlexWorks",
    price: 69999,
    stock: 14,
    images: [
      "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=1000&q=90"
    ],
    specs: { ram: "16GB", cpu: "Intel i5-1335U", storage: "512GB SSD", display: "14\" FHD Touch", stylus: "Included" },
  },

  // ===== MICE (7) =====
  {
    name: "ClickMax Wireless Mouse",
    description: "An ergonomic wireless mouse with silent clicks, designed for long work sessions without the noise. A comfortable, no-fuss choice for office use.",
    category: "mouse",
    brand: "ClickMax",
    price: 1299,
    stock: 50,
    images: [
      "https://images.unsplash.com/photo-1527814050087-3793815479db?auto=format&fit=crop&w=1000&q=90"
    ],
    specs: { dpi: 16000, wireless: true, buttons: 6 },
  },
  {
    name: "ProGrip Gaming Mouse",
    description: "A high-precision gaming mouse with customizable RGB lighting and a shape built for fast, accurate flick shots. Popular with competitive FPS players.",
    category: "mouse",
    brand: "ProGrip",
    price: 2499,
    stock: 35,
    images: [
      "https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?auto=format&fit=crop&w=1000&q=90"
    ],
    specs: { dpi: 25600, wireless: false, buttons: 8, rgb: true },
  },
  {
    name: "SilentClick Office Mouse",
    description: "A truly silent mouse designed for shared offices and late-night work, where every click of a regular mouse feels too loud. Comfortable for hours of continuous use.",
    category: "mouse",
    brand: "SilentClick",
    price: 999,
    stock: 45,
    images: [
      "https://images.unsplash.com/photo-1563297007-0686b7003af7?auto=format&fit=crop&w=1000&q=90"
    ],
    specs: { dpi: 4000, wireless: true, buttons: 4, silentClicks: true },
  },
  {
    name: "ErgoCurve Vertical Mouse",
    description: "A vertical mouse designed to keep your wrist in a natural handshake position, reducing strain during long working hours. Recommended for anyone dealing with wrist or forearm discomfort.",
    category: "mouse",
    brand: "ErgoCurve",
    price: 2199,
    stock: 20,
    images: [
      "https://commons.wikimedia.org/wiki/Special:Redirect/file/Raton_vertical_.png"
    ],
    specs: { dpi: 3200, wireless: true, buttons: 6, ergonomic: "Vertical 57°" },
  },
  {
    name: "TravelDot Mini Mouse",
    description: "A compact, pocket-sized mouse built for travel. Small enough to disappear into a laptop bag but still comfortable enough for a full day of use on the road.",
    category: "mouse",
    brand: "TravelDot",
    price: 899,
    stock: 40,
    images: [
      "https://images.unsplash.com/photo-1527814050087-3793815479db?auto=format&fit=crop&w=1000&q=90"
    ],
    specs: { dpi: 2400, wireless: true, buttons: 3, size: "Compact/Travel" },
  },
  {
    name: "PixelPrecision Mouse",
    description: "A high-DPI mouse aimed at designers and photo editors who need fine, accurate cursor control for detailed work in creative software.",
    category: "mouse",
    brand: "PixelPrecision",
    price: 3499,
    stock: 15,
    images: [
      "https://images.unsplash.com/photo-1613141412501-9012977f1969?auto=format&fit=crop&w=1000&q=90"
    ],
    specs: { dpi: 30000, wireless: true, buttons: 7, sensor: "Precision optical" },
  },
  {
    name: "MultiPair Bluetooth Mouse",
    description: "A Bluetooth mouse that remembers up to three devices and switches between them with the press of a button - useful for anyone juggling a laptop, tablet, and desktop through the day.",
    category: "mouse",
    brand: "MultiPair",
    price: 1799,
    stock: 28,
    images: [
      "https://images.unsplash.com/photo-1527814050087-3793815479db?auto=format&fit=crop&w=1000&q=90"
    ],
    specs: { dpi: 4000, wireless: true, buttons: 5, multiDevice: "Up to 3 devices" },
  },

  // ===== KEYBOARDS (8) =====
  {
    name: "MechType TKL Keyboard",
    description: "A compact tenkeyless mechanical keyboard with tactile blue switches. Drops the numpad to save desk space while keeping the satisfying click mechanical typists want.",
    category: "keyboard",
    brand: "MechType",
    price: 3499,
    stock: 30,
    images: [
      "https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=1000&q=90"
    ],
    specs: { switchType: "Mechanical Blue", layout: "TKL", backlight: "RGB" },
  },
  {
    name: "SilentKey Office Keyboard",
    description: "A quiet membrane keyboard designed specifically for office environments, where the clatter of mechanical switches isn't welcome. Comfortable, unremarkable, and reliable.",
    category: "keyboard",
    brand: "SilentKey",
    price: 1499,
    stock: 40,
    images: [
      "https://images.unsplash.com/photo-1595225476474-87563907a212?auto=format&fit=crop&w=1000&q=90"
    ],
    specs: { switchType: "Membrane", layout: "Full-size", backlight: "None" },
  },
  {
    name: "WaveBoard 60% Keyboard",
    description: "A compact 60% mechanical keyboard for minimal desk setups. Strips away the function row and arrow keys entirely, favoring a clean look over dedicated keys - built for enthusiasts who don't mind the learning curve.",
    category: "keyboard",
    brand: "WaveBoard",
    price: 4299,
    stock: 15,
    images: [
      "https://images.unsplash.com/photo-1511467687858-23d96c32e4ae?auto=format&fit=crop&w=1000&q=90"
    ],

    specs: { switchType: "Mechanical Red", layout: "60%", backlight: "RGB" },
  },
  {
    name: "ErgoSplit Keyboard",
    description: "A split ergonomic keyboard that lets each hand rest at a more natural angle and width apart. Takes a few days to adjust to, but many users find it noticeably reduces shoulder and wrist tension over long sessions.",
    category: "keyboard",
    brand: "ErgoSplit",
    price: 5999,
    stock: 12,
    images: [
      "https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=1000&q=90"
    ],
    specs: { switchType: "Mechanical Brown", layout: "Split ergonomic", backlight: "White" },
  },
  {
    name: "NumPad Companion",
    description: "A standalone numeric keypad for anyone using a TKL or 60% keyboard who still needs fast number entry for spreadsheets or data work. Connects wirelessly and sits neatly beside any keyboard.",
    category: "keyboard",
    brand: "NumPad",
    price: 999,
    stock: 25,
    images: [
      "https://images.unsplash.com/photo-1595225476474-87563907a212?auto=format&fit=crop&w=1000&q=90"
    ],
    specs: { switchType: "Membrane", layout: "Numpad only", backlight: "None", wireless: true },
  },
  {
    name: "LowProfile Slim Keyboard",
    description: "A slim, low-profile mechanical keyboard with a shallower keystroke than typical mechanical boards. Combines mechanical responsiveness with a flatter, laptop-like typing feel.",
    category: "keyboard",
    brand: "LowProfile",
    price: 3999,
    stock: 18,
    images: [
      "https://images.unsplash.com/photo-1511467687858-23d96c32e4ae?auto=format&fit=crop&w=1000&q=90"
    ],
    specs: { switchType: "Low-profile Mechanical", layout: "Full-size", backlight: "RGB" },
  },
  {
    name: "RGB Command Center",
    description: "A full-size RGB mechanical gaming keyboard with dedicated media keys and a volume roller. Built for gamers who want every key, every shortcut, and full lighting customization within reach.",
    category: "keyboard",
    brand: "CommandCenter",
    price: 6499,
    stock: 16,
    images: [
      "https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=1000&q=90"
    ],

    specs: { switchType: "Mechanical Red", layout: "Full-size", backlight: "Per-key RGB", mediaKeys: true },
  },
  {
    name: "TypeWriter Retro Keyboard",
    description: "A mechanical keyboard styled after vintage typewriters, with round keycaps and a warm color scheme. A statement piece for the desk as much as a typing tool, popular for home office setups.",
    category: "keyboard",
    brand: "TypeWriter",
    price: 4799,
    stock: 10,
    images: [
      "https://images.unsplash.com/photo-1595225476474-87563907a212?auto=format&fit=crop&w=1000&q=90"
    ],
    specs: { switchType: "Mechanical Brown", layout: "Full-size retro", backlight: "Amber" },
  },

  // ===== HEADPHONES (7) =====
  {
    name: "SoundWave ANC Headphones",
    description: "Over-ear headphones with active noise cancellation, built for commutes and open offices where blocking out the world matters. Comfortable padding for extended wear.",
    category: "headphones",
    brand: "SoundWave",
    price: 5999,
    stock: 20,
    images: [
      "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1000&q=90"
    ],
    specs: { driverSize: "40mm", noiseCancelling: true, wireless: true },
  },
  {
    name: "BassPro Studio Headphones",
    description: "Wired studio headphones with a deep, punchy bass response. A favorite among bass-heavy music listeners and casual producers who want sound without needing to charge anything.",
    category: "headphones",
    brand: "BassPro",
    price: 3299,
    stock: 25,
    images: [
      "https://images.unsplash.com/photo-1484704849700-f032a568e944?auto=format&fit=crop&w=1000&q=90"
    ],
    specs: { driverSize: "50mm", noiseCancelling: false, wireless: false },
  },
  {
    name: "AirBuds Pro True Wireless",
    description: "True wireless earbuds with active noise cancellation and a compact charging case. Built for daily commuting and workouts, with quick-pair setup and a snug, secure fit.",
    category: "headphones",
    brand: "AirBuds",
    price: 7499,
    stock: 22,
    images: [
      "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=1000&q=90"
    ],
    specs: { driverSize: "11mm", noiseCancelling: true, wireless: true, batteryLife: "6hrs + 24hrs case" },
  },
  {
    name: "StageMonitor Studio Headphones",
    description: "Flat-response reference headphones built for mixing and mastering, where accurate sound matters more than exaggerated bass. A solid pick for anyone getting into home music production.",
    category: "headphones",
    brand: "StageMonitor",
    price: 8999,
    stock: 8,
    images: [
      "https://images.unsplash.com/photo-1545127398-14699f92334b?auto=format&fit=crop&w=1000&q=90"
    ],

    specs: { driverSize: "45mm", noiseCancelling: false, wireless: false, response: "Flat/reference" },
  },
  {
    name: "SportFit Wireless Earbuds",
    description: "Sweat and water-resistant wireless earbuds designed for the gym and outdoor runs. Secure ear-hook fit that stays put through high-intensity workouts.",
    category: "headphones",
    brand: "SportFit",
    price: 3999,
    stock: 30,
    images: [
      "https://images.unsplash.com/photo-1598331668826-20cecc596b86?auto=format&fit=crop&w=1000&q=90"
    ],
    specs: { driverSize: "10mm", noiseCancelling: false, wireless: true, waterResistance: "IPX7" },
  },
  {
    name: "GamerVoice 7.1 Headset",
    description: "A gaming headset with virtual 7.1 surround sound and a detachable noise-cancelling microphone. Built for hearing footsteps first in competitive shooters.",
    category: "headphones",
    brand: "GamerVoice",
    price: 4599,
    stock: 18,
    images: [
      "https://images.unsplash.com/photo-1583394838336-acd977736f90?auto=format&fit=crop&w=1000&q=90"
    ],
    specs: { driverSize: "50mm", noiseCancelling: false, wireless: false, surround: "Virtual 7.1", mic: "Detachable" },
  },
  {
    name: "TravelMute ANC Earbuds",
    description: "Compact noise-cancelling earbuds built for flights and travel, with a case small enough to fit in a jeans pocket. Strong ANC for engine drone and background chatter.",
    category: "headphones",
    brand: "TravelMute",
    price: 5499,
    stock: 20,
    images: [
      "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=1000&q=90"
    ],
    specs: { driverSize: "10mm", noiseCancelling: true, wireless: true, batteryLife: "5hrs + 20hrs case" },
  },
];

// Map a CSV row to our Product schema shape.
// UPDATE THESE FIELD NAMES once real CSV headers are known.
function mapRowToProduct(row) {
  return {
    name: row.name,
    description: row.description || "",
    category: (row.category || "other").toLowerCase(),
    brand: row.brand || "",
    price: Number(row.price) || 0,
    stock: Number(row.stock) || 0,
    images: row.images ? row.images.split("|") : [],
    specs: row.specs ? JSON.parse(row.specs) : {},
  };
}

async function loadFromCSV() {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(CSV_PATH)
      .pipe(csv())
      .on("data", (row) => results.push(mapRowToProduct(row)))
      .on("end", () => resolve(results))
      .on("error", reject);
  });
}

async function seed() {
  await connectDB();

  let products;
  if (fs.existsSync(CSV_PATH)) {
    console.log("Loading products from CSV...");
    products = await loadFromCSV();
  } else {
    console.log("No products.csv found - using sample data instead.");
    products = sampleProducts;
  }

  await Product.deleteMany({});
  await Product.insertMany(products);

  console.log(`Seeded ${products.length} products.`);
  await mongoose.connection.close();
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});