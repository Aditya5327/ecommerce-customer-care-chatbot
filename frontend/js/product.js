let currentProduct = null;
let selectedQty = 1;

function getProductIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id");
}

async function loadProductDetail() {
  const root = document.getElementById("product-detail-root");
  const id = getProductIdFromUrl();

  if (!id) {
    root.innerHTML = `<div class="empty-state">No product specified.</div>`;
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/products/${id}`);
    if (!res.ok) {
      root.innerHTML = `<div class="empty-state">Product not found.</div>`;
      return;
    }
    currentProduct = await res.json();
    renderProductDetail(currentProduct);
  } catch (err) {
    root.innerHTML = `<div class="empty-state">Couldn't load product. Is the backend running?</div>`;
    console.error(err);
  }
}

function renderProductDetail(p) {
  const root = document.getElementById("product-detail-root");
  const image =
    p.images && p.images[0]
      ? p.images[0]
      : "https://placehold.co/600x600/131b2e/5eead4?text=No+Image";

  const specRows = Object.entries(p.specs || {})
    .map(
      ([key, value]) => `
      <div class="spec-row">
        <span class="spec-label">${formatSpecLabel(key)}</span>
        <span class="spec-value">${value}</span>
      </div>`
    )
    .join("");

  root.innerHTML = `
    <div class="product-detail">
      <div class="product-detail-image">
        <img src="${image}" alt="${p.name}" />
      </div>
      <div>
        <div class="product-detail-category">${p.category}</div>
        <h1>${p.name}</h1>
        <div class="product-detail-price">${formatPrice(p.price)}</div>
        <p class="product-detail-desc">${p.description || ""}</p>

        ${specRows ? `<div class="spec-readout">${specRows}</div>` : ""}

        <div style="margin-top:24px;">
          <div class="qty-selector">
            <button class="qty-btn" id="qty-minus">−</button>
            <span class="qty-value" id="qty-value">1</span>
            <button class="qty-btn" id="qty-plus">+</button>
          </div>

          <button
            class="btn btn-primary btn-block"
            id="add-to-cart-btn"
            ${p.stock <= 0 ? "disabled" : ""}
          >
            ${p.stock <= 0 ? "Out of stock" : "Add to cart"}
          </button>
        </div>
      </div>
    </div>
  `;

  document.getElementById("qty-minus").addEventListener("click", () => {
    selectedQty = Math.max(1, selectedQty - 1);
    document.getElementById("qty-value").textContent = selectedQty;
  });

  document.getElementById("qty-plus").addEventListener("click", () => {
    selectedQty = Math.min(p.stock, selectedQty + 1);
    document.getElementById("qty-value").textContent = selectedQty;
  });

  document.getElementById("add-to-cart-btn").addEventListener("click", async () => {
    const btn = document.getElementById("add-to-cart-btn");
    const original = btn.textContent;

    if (!isLoggedIn()) {
      btn.textContent = "Log in to add to cart";
      setTimeout(() => {
        window.location.href = `login.html?next=${encodeURIComponent(`product.html?id=${p._id}`)}`;
      }, 800);
      return;
    }

    btn.disabled = true;
    btn.textContent = "Adding...";

    const result = await addToCart(p._id, selectedQty);

    if (result.error) {
      btn.textContent = result.error;
      setTimeout(() => {
        btn.textContent = original;
        btn.disabled = false;
      }, 1500);
      return;
    }

    btn.textContent = "Added ✓";
    setTimeout(() => {
      btn.textContent = original;
      btn.disabled = false;
    }, 1200);
  });
}

document.addEventListener("DOMContentLoaded", loadProductDetail);
