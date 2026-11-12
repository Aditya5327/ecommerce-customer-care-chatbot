async function renderCart() {
  const itemsRoot = document.getElementById("cart-items-root");
  const summaryRoot = document.getElementById("cart-summary-root");

  if (!isLoggedIn()) {
    itemsRoot.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🔒</div>
        <p>Log in to see your cart.</p>
        <div style="margin-top:20px;">
          <a href="login.html?next=cart.html" class="btn btn-primary">Log in</a>
        </div>
      </div>
    `;
    summaryRoot.innerHTML = "";
    return;
  }

  itemsRoot.innerHTML = `<div class="loading-text">Loading cart...</div>`;
  const cart = await fetchCart();

  if (!cart.items.length) {
    itemsRoot.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🛒</div>
        <p>Your cart is empty.</p>
        <div style="margin-top:20px;">
          <a href="index.html" class="btn btn-primary">Browse products</a>
        </div>
      </div>
    `;
    summaryRoot.innerHTML = "";
    return;
  }

  itemsRoot.innerHTML = cart.items
    .map(
      (item) => `
    <div class="cart-item" data-id="${item.productId}">
      <img src="${
        item.image || "https://placehold.co/160x160/131b2e/5eead4?text=No+Image"
      }" alt="${item.name}" />
      <div>
        <div class="cart-item-name">${item.name}</div>
        <div class="cart-item-price">${formatPrice(item.price)}</div>
      </div>
      <div class="qty-selector" style="margin:0;">
        <button class="qty-btn cart-qty-minus" data-id="${item.productId}">−</button>
        <span class="qty-value">${item.quantity}</span>
        <button class="qty-btn cart-qty-plus" data-id="${item.productId}" data-max="${item.stock}">+</button>
      </div>
      <button class="btn btn-danger cart-remove" data-id="${item.productId}">Remove</button>
    </div>
  `
    )
    .join("");

  summaryRoot.innerHTML = `
    <div class="cart-summary">
      <div class="cart-summary-row">
        <span>Items (${cart.itemCount})</span>
        <span>${formatPrice(cart.subtotal)}</span>
      </div>
      <div class="cart-summary-row total">
        <span>Total</span>
        <span>${formatPrice(cart.total)}</span>
      </div>
      <div style="margin-top:20px;">
        <a href="checkout.html" class="btn btn-primary btn-block">Proceed to checkout</a>
      </div>
    </div>
  `;

  attachCartEventListeners();
}

function attachCartEventListeners() {
  document.querySelectorAll(".cart-qty-minus").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const cart = getCachedCart();
      const item = cart.items.find((i) => i.productId === btn.dataset.id);
      if (item && item.quantity > 1) {
        await updateCartQuantity(item.productId, item.quantity - 1);
      } else if (item) {
        await removeFromCart(item.productId);
      }
      renderCart();
    });
  });

  document.querySelectorAll(".cart-qty-plus").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const cart = getCachedCart();
      const item = cart.items.find((i) => i.productId === btn.dataset.id);
      const max = Number(btn.dataset.max);
      if (item) {
        if (item.quantity >= max) {
          alert(`Only ${max} in stock`);
          return;
        }
        await updateCartQuantity(item.productId, item.quantity + 1);
      }
      renderCart();
    });
  });

  document.querySelectorAll(".cart-remove").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await removeFromCart(btn.dataset.id);
      renderCart();
    });
  });
}

document.addEventListener("DOMContentLoaded", renderCart);
