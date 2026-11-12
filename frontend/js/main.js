// ========================================
// Shared config
// ========================================
const API_BASE = "http://localhost:5000/api";

// ========================================
// Auth helpers (used by every page)
// ========================================
function getToken() {
  return localStorage.getItem("token");
}

function getUser() {
  const raw = localStorage.getItem("user");
  return raw ? JSON.parse(raw) : null;
}

function isLoggedIn() {
  return !!getToken();
}

function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.location.href = "index.html";
}

function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ========================================
// Cart helpers - now backed by the real server-side cart (/api/cart)
// instead of localStorage. Cart requires login, since it's tied to
// the authenticated user - guests are prompted to log in.
// Cached response shape: { items: [...], subtotal, total, itemCount }
// ========================================
let _cartCache = null;

async function fetchCart() {
  if (!isLoggedIn()) {
    _cartCache = { items: [], subtotal: 0, total: 0, itemCount: 0 };
    return _cartCache;
  }
  try {
    const res = await fetch(`${API_BASE}/cart`, { headers: authHeaders() });
    if (!res.ok) throw new Error("Failed to load cart");
    _cartCache = await res.json();
    return _cartCache;
  } catch (err) {
    console.error(err);
    _cartCache = { items: [], subtotal: 0, total: 0, itemCount: 0 };
    return _cartCache;
  }
}

function getCachedCart() {
  // Synchronous read of the last-fetched cart, used for quick UI updates
  // (e.g. badge count) without re-fetching. Call fetchCart() first on
  // page load to populate this.
  return _cartCache || { items: [], subtotal: 0, total: 0, itemCount: 0 };
}

async function addToCart(productId, quantity = 1) {
  if (!isLoggedIn()) {
    return { requiresLogin: true };
  }
  const res = await fetch(`${API_BASE}/cart/items`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ productId, quantity }),
  });
  const data = await res.json();
  if (!res.ok) {
    return { error: data.message || "Couldn't add to cart" };
  }
  _cartCache = data;
  updateCartBadge();
  return { success: true, cart: data };
}

async function removeFromCart(productId) {
  const res = await fetch(`${API_BASE}/cart/items/${productId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  const data = await res.json();
  if (res.ok) {
    _cartCache = data;
    updateCartBadge();
  }
  return data;
}

async function updateCartQuantity(productId, quantity) {
  const res = await fetch(`${API_BASE}/cart/items/${productId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ quantity }),
  });
  const data = await res.json();
  if (res.ok) {
    _cartCache = data;
    updateCartBadge();
  }
  return data;
}

async function clearCart() {
  await fetch(`${API_BASE}/cart`, { method: "DELETE", headers: authHeaders() });
  _cartCache = { items: [], subtotal: 0, total: 0, itemCount: 0 };
  updateCartBadge();
}

function updateCartBadge() {
  const badge = document.getElementById("cart-badge");
  if (badge) {
    const count = getCachedCart().itemCount;
    badge.textContent = count;
    badge.style.display = count > 0 ? "flex" : "none";
  }
}

// ========================================
// Formatting helpers
// ========================================
function formatPrice(amount) {
  return `₹${Number(amount).toLocaleString("en-IN")}`;
}

function formatSpecLabel(key) {
  // camelCase -> Title Case, e.g. "driverSize" -> "Driver Size"
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

// ========================================
// Nav auth state - shows Login or user name depending on login status
// ========================================

// function renderNavAuthState() {
//   const slot = document.getElementById("nav-auth-slot");
//   if (!slot) return;

//   if (isLoggedIn()) {
//     const user = getUser();
//     slot.innerHTML = `
//       <a href="orders.html">${user ? user.name.split(" ")[0] : "Account"}</a>
//       <a href="#" id="logout-link">Logout</a>
//     `;
//     document.getElementById("logout-link").addEventListener("click", (e) => {
//       e.preventDefault();
//       logout();
//     });
//   } else {
//     slot.innerHTML = `<a href="login.html">Login</a>`;
//   }
// }

function renderNavAuthState() {
  const slot = document.getElementById("nav-auth-slot");
  if (!slot) return;

  if (isLoggedIn()) {
    const user = getUser();

    const firstName = user?.name
      ? user.name.split(" ")[0]
      : "Account";

    slot.innerHTML = `
      <div class="account-menu">
        <button class="account-btn" id="account-btn">
          👤 ${firstName}
          <span class="account-arrow">▾</span>
        </button>

        <div class="account-dropdown" id="account-dropdown">
          <div class="account-header">
            <strong>${user?.name || "Account"}</strong>
            <span>${user?.email || ""}</span>
          </div>

          <a href="orders.html">
            📦 My Orders
          </a>

          <a href="change-password.html">
            🔑 Change Password
          </a>

          <button id="logout-link" class="account-logout">
            🚪 Logout
          </button>
        </div>
      </div>
    `;

    const accountBtn = document.getElementById("account-btn");
    const dropdown = document.getElementById("account-dropdown");

    accountBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      dropdown.classList.toggle("show");
    });

    document.addEventListener("click", () => {
      dropdown.classList.remove("show");
    });

    document
      .getElementById("logout-link")
      .addEventListener("click", () => {
        logout();
      });
  } else {
    slot.innerHTML = `<a href="login.html">Login</a>`;
  }
}

// ========================================
// Homepage: fetch and render product grid
// ========================================
async function loadProducts(category = "") {
  const grid = document.getElementById("product-grid");
  if (!grid) return;

  grid.innerHTML = `<div class="loading-text">Loading products...</div>`;

  try {
    const url = category
      ? `${API_BASE}/products?category=${encodeURIComponent(category)}`
      : `${API_BASE}/products`;
    const res = await fetch(url);
    const products = await res.json();

    if (!products.length) {
      grid.innerHTML = `<div class="empty-state">No products found.</div>`;
      return;
    }

    grid.innerHTML = products
      .map(
        (p) => `
      <a href="product.html?id=${p._id}" class="product-card">
        <img class="product-card-image" src="${p.images && p.images[0] ? p.images[0] : "https://placehold.co/400x400/131b2e/5eead4?text=No+Image"
          }" alt="${p.name}" />
        <div class="product-card-body">
          <div class="product-card-category">${p.category}</div>
          <div class="product-card-name">${p.name}</div>
          <div class="product-card-price">${formatPrice(p.price)}</div>
          <div class="product-card-stock">${p.stock > 0 ? `${p.stock} in stock` : "Out of stock"
          }</div>
        </div>
      </a>
    `
      )
      .join("");
  } catch (err) {
    grid.innerHTML = `<div class="empty-state">Couldn't load products. Is the backend running on port 5000?</div>`;
    console.error(err);
  }
}

function setupCategoryFilters() {
  const chips = document.querySelectorAll(".filter-chip");
  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      chips.forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      loadProducts(chip.dataset.category);
    });
  });
}

// ========================================
// Init - runs on every page
// ========================================
document.addEventListener("DOMContentLoaded", async () => {
  await fetchCart();
  updateCartBadge();
  renderNavAuthState();

  if (document.getElementById("product-grid")) {
    loadProducts();
    setupCategoryFilters();
  }
});

// Browsers sometimes restore a page from an in-memory snapshot (back/
// forward cache) instead of actually reloading it - e.g. clicking the
// back button. That snapshot can be stale (e.g. cart count from before
// you added something on another page), so force a fresh check whenever
// that happens.
window.addEventListener("pageshow", (event) => {
  if (event.persisted) {
    fetchCart().then(updateCartBadge);
  }
});