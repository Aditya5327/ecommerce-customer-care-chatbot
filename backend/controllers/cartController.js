// const Cart = require("../models/Cart");
// const Product = require("../models/Product");

// /**
//  * Shared helper: turns a Cart document into the response shape the
//  * frontend (and later the chatbot) actually wants - live product info
//  * joined in, plus computed subtotal/total. Any item whose product was
//  * deleted/deactivated is silently dropped from the response (but left
//  * in the DB) so a removed product doesn't crash the cart view.
//  */
// async function buildCartResponse(cart) {
//   if (!cart || !cart.items.length) {
//     return { items: [], subtotal: 0, total: 0, itemCount: 0 };
//   }

//   const items = [];
//   let subtotal = 0;

//   for (const entry of cart.items) {
//     const product = await Product.findById(entry.product);
//     if (!product || !product.isActive) continue; // skip vanished products

//     const lineTotal = product.price * entry.quantity;
//     subtotal += lineTotal;

//     items.push({
//       productId: product._id,
//       name: product.name,
//       price: product.price,
//       image: product.images && product.images[0] ? product.images[0] : "",
//       quantity: entry.quantity,
//       stock: product.stock,
//       lineTotal,
//     });
//   }

//   return {
//     items,
//     subtotal,
//     total: subtotal, // shipping/tax logic would extend this later
//     itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
//   };
// }

// // GET /api/cart
// const getCart = async (req, res, next) => {
//   try {
//     const cart = await Cart.findOne({ user: req.user.id });
//     const response = await buildCartResponse(cart);
//     res.json(response);
//   } catch (err) {
//     next(err);
//   }
// };

// // POST /api/cart/items
// // Body: { productId, quantity }
// const addToCart = async (req, res, next) => {
//   try {
//     const { productId, quantity = 1 } = req.body;

//     if (!productId || quantity < 1) {
//       return res.status(400).json({ message: "productId and a valid quantity are required" });
//     }

//     const product = await Product.findById(productId);
//     if (!product || !product.isActive) {
//       return res.status(404).json({ message: "Product not found" });
//     }

//     let cart = await Cart.findOne({ user: req.user.id });
//     if (!cart) {
//       cart = new Cart({ user: req.user.id, items: [] });
//     }

//     const existing = cart.items.find((i) => i.product.toString() === productId);
//     const newQuantity = existing ? existing.quantity + quantity : quantity;

//     if (product.stock < newQuantity) {
//       return res.status(400).json({
//         message: `Only ${product.stock} unit(s) of ${product.name} available`,
//       });
//     }

//     if (existing) {
//       existing.quantity = newQuantity;
//     } else {
//       cart.items.push({ product: productId, quantity });
//     }

//     await cart.save();
//     const response = await buildCartResponse(cart);
//     res.status(201).json(response);
//   } catch (err) {
//     next(err);
//   }
// };

// // PUT /api/cart/items/:productId
// // Body: { quantity }
// const updateCartItem = async (req, res, next) => {
//   try {
//     const { productId } = req.params;
//     const { quantity } = req.body;

//     if (!quantity || quantity < 1) {
//       return res.status(400).json({ message: "A valid quantity is required" });
//     }

//     const product = await Product.findById(productId);
//     if (!product) {
//       return res.status(404).json({ message: "Product not found" });
//     }
//     if (product.stock < quantity) {
//       return res.status(400).json({
//         message: `Only ${product.stock} unit(s) of ${product.name} available`,
//       });
//     }

//     const cart = await Cart.findOne({ user: req.user.id });
//     if (!cart) {
//       return res.status(404).json({ message: "Cart not found" });
//     }

//     const item = cart.items.find((i) => i.product.toString() === productId);
//     if (!item) {
//       return res.status(404).json({ message: "Item not in cart" });
//     }

//     item.quantity = quantity;
//     await cart.save();

//     const response = await buildCartResponse(cart);
//     res.json(response);
//   } catch (err) {
//     next(err);
//   }
// };

// // DELETE /api/cart/items/:productId
// const removeFromCart = async (req, res, next) => {
//   try {
//     const { productId } = req.params;

//     const cart = await Cart.findOne({ user: req.user.id });
//     if (!cart) {
//       return res.status(404).json({ message: "Cart not found" });
//     }

//     cart.items = cart.items.filter((i) => i.product.toString() !== productId);
//     await cart.save();

//     const response = await buildCartResponse(cart);
//     res.json(response);
//   } catch (err) {
//     next(err);
//   }
// };

// // DELETE /api/cart - clear the whole cart (used after successful checkout)
// const clearCart = async (req, res, next) => {
//   try {
//     await Cart.findOneAndUpdate(
//       { user: req.user.id },
//       { items: [] },
//       { upsert: true }
//     );
//     res.json({ items: [], subtotal: 0, total: 0, itemCount: 0 });
//   } catch (err) {
//     next(err);
//   }
// };

// module.exports = { getCart, addToCart, updateCartItem, removeFromCart, clearCart };


const Cart = require("../models/Cart");
const Product = require("../models/Product");

/**
 * Self-heals a cart that has duplicate entries for the same product
 * (a bug in an earlier version of addToCart could create these under
 * rapid/concurrent requests). Merges quantities for any duplicate
 * product entries and persists the fix if anything changed.
 */
async function dedupeCart(cart) {
  if (!cart || cart.items.length < 2) return cart;

  const merged = new Map(); // productId string -> quantity
  for (const entry of cart.items) {
    const key = entry.product.toString();
    merged.set(key, (merged.get(key) || 0) + entry.quantity);
  }

  const hadDuplicates = merged.size !== cart.items.length;
  if (!hadDuplicates) return cart;

  cart.items = Array.from(merged.entries()).map(([product, quantity]) => ({
    product,
    quantity,
  }));
  await cart.save();
  return cart;
}

/**
 * Shared helper: turns a Cart document into the response shape the
 * frontend (and later the chatbot) actually wants - live product info
 * joined in, plus computed subtotal/total. Any item whose product was
 * deleted/deactivated is silently dropped from the response (but left
 * in the DB) so a removed product doesn't crash the cart view.
 */
async function buildCartResponse(cart) {
  if (!cart || !cart.items.length) {
    return { items: [], subtotal: 0, total: 0, itemCount: 0 };
  }

  const items = [];
  let subtotal = 0;

  for (const entry of cart.items) {
    const product = await Product.findById(entry.product);
    if (!product || !product.isActive) continue; // skip vanished products

    const lineTotal = product.price * entry.quantity;
    subtotal += lineTotal;

    items.push({
      productId: product._id,
      name: product.name,
      price: product.price,
      image: product.images && product.images[0] ? product.images[0] : "",
      quantity: entry.quantity,
      stock: product.stock,
      lineTotal,
    });
  }

  return {
    items,
    subtotal,
    total: subtotal, // shipping/tax logic would extend this later
    itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
  };
}

// GET /api/cart
const getCart = async (req, res, next) => {
  try {
    let cart = await Cart.findOne({ user: req.user.id });
    cart = await dedupeCart(cart); // self-heal any pre-existing duplicates
    const response = await buildCartResponse(cart);
    res.json(response);
  } catch (err) {
    next(err);
  }
};

// POST /api/cart/items
// Body: { productId, quantity }
// Uses atomic MongoDB updates (not read-then-write) so rapid/concurrent
// adds of the same product can't create duplicate line items.
const addToCart = async (req, res, next) => {
  try {
    const { productId, quantity = 1 } = req.body;

    if (!productId || quantity < 1) {
      return res.status(400).json({ message: "productId and a valid quantity are required" });
    }

    const product = await Product.findById(productId);
    if (!product || !product.isActive) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Best-effort stock check against current known quantity (a very rare
    // double-submit could still slip past this by a unit or two, but it
    // eliminates the duplicate-line-item bug, which is the real problem).
    const existingCart = await Cart.findOne({ user: req.user.id });
    const existingItem = existingCart?.items.find((i) => i.product.toString() === productId);
    const projectedQuantity = (existingItem?.quantity || 0) + quantity;

    if (product.stock < projectedQuantity) {
      return res.status(400).json({
        message: `Only ${product.stock} unit(s) of ${product.name} available`,
      });
    }

    // Step 1: try to atomically bump the quantity of an existing line item
    let cart = await Cart.findOneAndUpdate(
      { user: req.user.id, "items.product": productId },
      { $inc: { "items.$.quantity": quantity } },
      { new: true }
    );

    // Step 2: no existing line item matched - atomically push a new one,
    // creating the cart document itself if this is the user's first item
    if (!cart) {
      cart = await Cart.findOneAndUpdate(
        { user: req.user.id },
        { $push: { items: { product: productId, quantity } } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }

    const response = await buildCartResponse(cart);
    res.status(201).json(response);
  } catch (err) {
    next(err);
  }
};

// PUT /api/cart/items/:productId
// Body: { quantity }
const updateCartItem = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const { quantity } = req.body;

    if (!quantity || quantity < 1) {
      return res.status(400).json({ message: "A valid quantity is required" });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    if (product.stock < quantity) {
      return res.status(400).json({
        message: `Only ${product.stock} unit(s) of ${product.name} available`,
      });
    }

    const cart = await Cart.findOne({ user: req.user.id });
    if (!cart) {
      return res.status(404).json({ message: "Cart not found" });
    }
    await dedupeCart(cart);

    const item = cart.items.find((i) => i.product.toString() === productId);
    if (!item) {
      return res.status(404).json({ message: "Item not in cart" });
    }

    item.quantity = quantity;
    await cart.save();

    const response = await buildCartResponse(cart);
    res.json(response);
  } catch (err) {
    next(err);
  }
};

// DELETE /api/cart/items/:productId
const removeFromCart = async (req, res, next) => {
  try {
    const { productId } = req.params;

    const cart = await Cart.findOne({ user: req.user.id });
    if (!cart) {
      return res.status(404).json({ message: "Cart not found" });
    }

    cart.items = cart.items.filter((i) => i.product.toString() !== productId);
    await cart.save();

    const response = await buildCartResponse(cart);
    res.json(response);
  } catch (err) {
    next(err);
  }
};

// DELETE /api/cart - clear the whole cart (used after successful checkout)
const clearCart = async (req, res, next) => {
  try {
    await Cart.findOneAndUpdate(
      { user: req.user.id },
      { items: [] },
      { upsert: true }
    );
    res.json({ items: [], subtotal: 0, total: 0, itemCount: 0 });
  } catch (err) {
    next(err);
  }
};

module.exports = { getCart, addToCart, updateCartItem, removeFromCart, clearCart };