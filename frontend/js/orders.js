async function loadOrders() {
  const root = document.getElementById("orders-root");

  if (!isLoggedIn()) {
    root.innerHTML = `
      <div class="empty-state">
        <p>Log in to view your orders.</p>
        <div style="margin-top:20px;">
          <a href="login.html" class="btn btn-primary">Log in</a>
        </div>
      </div>
    `;
    return;
  }

  root.innerHTML = `<div class="loading-text">Loading orders...</div>`;

  try {
    const res = await fetch(`${API_BASE}/orders`, { headers: authHeaders() });
    const orders = await res.json();

    if (!res.ok) {
      root.innerHTML = `<div class="empty-state">${orders.message || "Couldn't load orders"}</div>`;
      return;
    }

    if (!orders.length) {
      root.innerHTML = `
        <div class="empty-state">
          <p>No orders yet.</p>
          <div style="margin-top:20px;">
            <a href="index.html" class="btn btn-primary">Start shopping</a>
          </div>
        </div>
      `;
      return;
    }

    root.innerHTML = orders.map(renderOrderCard).join("");
    attachOrderActionListeners();
  } catch (err) {
    root.innerHTML = `<div class="empty-state">Couldn't reach the server.</div>`;
    console.error(err);
  }
}

function renderOrderCard(order) {
  const itemRows = order.items
    .map(
      (item) => `
      <div class="order-item-row">
        <span>${item.name} × ${item.quantity}</span>
        <span>${formatPrice(item.price * item.quantity)}</span>
      </div>`
    )
    .join("");

  const canCancel = ["pending", "confirmed"].includes(order.status);
  const canReturn = order.status === "delivered";
  const hasRefund = order.refund && order.refund.status !== "none";

  return `
    <div class="order-card" data-id="${order._id}">
      <div class="order-card-header">
        <span class="order-number-tag">Order #${order.orderNumber}</span>
        <span class="order-status status-${order.status}">${order.status.replace("_", " ")}</span>
      </div>
      ${itemRows}
      <div class="cart-summary-row total" style="border:none; margin-top:8px; padding-top:8px;">
        <span>Total</span>
        <span>${formatPrice(order.totalAmount)}</span>
      </div>
      ${
        hasRefund
          ? `<div class="order-item-row"><span>Refund</span><span>${order.refund.status.replace("_", " ")}</span></div>`
          : ""
      }
      ${
        canCancel
          ? `<div class="order-actions"><button class="btn btn-danger cancel-order-btn" data-id="${order._id}">Cancel order</button></div>`
          : ""
      }
      ${
        canReturn
          ? `<div class="order-actions"><button class="btn btn-secondary return-order-btn" data-id="${order._id}">Request return</button></div>`
          : ""
      }
    </div>
  `;
}

function attachOrderActionListeners() {
  document.querySelectorAll(".cancel-order-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Cancel this order?")) return;
      await patchOrder(btn.dataset.id, "cancel");
    });
  });

  document.querySelectorAll(".return-order-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Request a return for this order?")) return;
      await patchOrder(btn.dataset.id, "return");
    });
  });
}

async function patchOrder(orderId, action) {
  try {
    const res = await fetch(`${API_BASE}/orders/${orderId}/${action}`, {
      method: "PATCH",
      headers: authHeaders(),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.message || "Action failed");
      return;
    }
    loadOrders(); // refresh list
  } catch (err) {
    alert("Couldn't reach the server.");
    console.error(err);
  }
}

document.addEventListener("DOMContentLoaded", loadOrders);
