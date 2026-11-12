function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function getChatCheckoutData() {
  try {
    const saved = sessionStorage.getItem("circuitcart_chat_checkout");
    return saved ? JSON.parse(saved) : null;
  } catch (err) {
    console.warn("Could not read chatbot checkout data", err);
    return null;
  }
}

// async function renderCheckoutForm() {
//   const root = document.getElementById("checkout-root");

//   if (!isLoggedIn()) {
//     root.innerHTML = `
//       <div class="empty-state">
//         <p>You need to be logged in to check out.</p>
//         <div style="margin-top:20px;">
//           <a href="login.html?next=checkout.html" class="btn btn-primary">Log in</a>
//         </div>
//       </div>
//     `;
//     return;
//   }

//   root.innerHTML = `<div class="loading-text">Loading cart...</div>`;
//   const cart = await fetchCart();

//   if (!cart.items.length) {
//     root.innerHTML = `
//       <div class="empty-state">
//         <p>Your cart is empty.</p>
//         <div style="margin-top:20px;">
//           <a href="index.html" class="btn btn-primary">Browse products</a>
//         </div>
//       </div>
//     `;
//     return;
//   }

//   const total = cart.total;

//   root.innerHTML = `
//     <form id="checkout-form">
//       <div class="form-group">
//         <label for="line1">Address line 1</label>
//         <input type="text" id="line1" required />
//       </div>
//       <div class="form-group">
//         <label for="line2">Address line 2 (optional)</label>
//         <input type="text" id="line2" />
//       </div>
//       <div class="form-group">
//         <label for="city">City</label>
//         <input type="text" id="city" required />
//       </div>
//       <div class="form-group">
//         <label for="state">State</label>
//         <input type="text" id="state" required />
//       </div>
//       <div class="form-group">
//         <label for="postalCode">Postal code</label>
//         <input type="text" id="postalCode" required />
//       </div>

//       <div class="cart-summary" style="margin: 24px 0;">
//         <div class="cart-summary-row total">
//           <span>Total to pay</span>
//           <span>${formatPrice(total)}</span>
//         </div>
//       </div>

//       <div class="form-error" id="form-error"></div>
//       <button type="submit" class="btn btn-primary btn-block" id="pay-btn">
//         Pay ${formatPrice(total)} with Razorpay
//       </button>
//     </form>
//   `;

//   document
//     .getElementById("checkout-form")
//     .addEventListener("submit", handleCheckoutSubmit);
// }

async function renderCheckoutForm() {
  const root = document.getElementById("checkout-root");

  if (!isLoggedIn()) {
    root.innerHTML = `
      <div class="empty-state">
        <p>You need to be logged in to check out.</p>
        <div style="margin-top:20px;">
          <a href="login.html?next=checkout.html" class="btn btn-primary">
            Log in
          </a>
        </div>
      </div>
    `;
    return;
  }

  // Check whether checkout came from chatbot
  const chatCheckoutData = getChatCheckoutData();

  let cart = null;

  // Normal checkout still loads the cart.
  // Chatbot checkout already has all required checkout information.
  if (!chatCheckoutData) {
    root.innerHTML = `<div class="loading-text">Loading cart...</div>`;

    try {
      cart = await fetchCart();
    } catch (err) {
      console.error("Failed to load cart:", err);

      root.innerHTML = `
        <div class="empty-state">
          <p>Couldn't load your cart.</p>
          <div style="margin-top:20px;">
            <a href="cart.html" class="btn btn-primary">
              Back to cart
            </a>
          </div>
        </div>
      `;

      return;
    }

    if (!cart?.items?.length) {
      root.innerHTML = `
        <div class="empty-state">
          <p>Your cart is empty.</p>
          <div style="margin-top:20px;">
            <a href="index.html" class="btn btn-primary">
              Browse products
            </a>
          </div>
        </div>
      `;

      return;
    }
  }

  // Use chatbot checkout data when available
  const total = Number(
    chatCheckoutData?.totalAmount ?? cart?.total ?? 0
  );

  const savedAddress =
    chatCheckoutData?.shippingAddress || {};

  const value = (field) =>
    escapeHtml(String(savedAddress[field] || ""));

  root.innerHTML = `
    <form id="checkout-form">

      <div class="form-group">
        <label for="line1">Address line 1</label>
        <input
          type="text"
          id="line1"
          value="${value("line1")}"
          required
        />
      </div>

      <div class="form-group">
        <label for="line2">
          Address line 2 (optional)
        </label>
        <input
          type="text"
          id="line2"
          value="${value("line2")}"
        />
      </div>

      <div class="form-group">
        <label for="city">City</label>
        <input
          type="text"
          id="city"
          value="${value("city")}"
          required
        />
      </div>

      <div class="form-group">
        <label for="state">State</label>
        <input
          type="text"
          id="state"
          value="${value("state")}"
          required
        />
      </div>

      <div class="form-group">
        <label for="postalCode">Postal code</label>
        <input
          type="text"
          id="postalCode"
          value="${value("postalCode")}"
          required
        />
      </div>

      <div class="cart-summary" style="margin: 24px 0;">
        <div class="cart-summary-row total">
          <span>Total to pay</span>
          <span>${formatPrice(total)}</span>
        </div>
      </div>

      <div class="form-error" id="form-error"></div>

      <button
        type="submit"
        class="btn btn-primary btn-block"
        id="pay-btn"
      >
        Pay ${formatPrice(total)} with Razorpay
      </button>

    </form>
  `;

  document
    .getElementById("checkout-form")
    .addEventListener(
      "submit",
      handleCheckoutSubmit
    );
}

// async function handleCheckoutSubmit(e) {
//   e.preventDefault();
//   const errorEl = document.getElementById("form-error");
//   const payBtn = document.getElementById("pay-btn");
//   errorEl.textContent = "";
//   payBtn.disabled = true;
//   payBtn.textContent = "Preparing payment...";

//   const shippingAddress = {
//     line1: document.getElementById("line1").value.trim(),
//     line2: document.getElementById("line2").value.trim(),
//     city: document.getElementById("city").value.trim(),
//     state: document.getElementById("state").value.trim(),
//     postalCode: document.getElementById("postalCode").value.trim(),
//     country: "India",
//   };

//   const cart = getCachedCart();
//   const items = cart.items.map((item) => ({
//     productId: item.productId,
//     quantity: item.quantity,
//   }));

//   try {
//     // Step 1: ask backend to validate stock/price and create a Razorpay order
//     const res = await fetch(`${API_BASE}/checkout/create-order`, {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//         ...authHeaders(),
//       },
//       body: JSON.stringify({ items, shippingAddress }),
//     });
//     const data = await res.json();

//     if (!res.ok) {
//       errorEl.textContent = data.message || "Couldn't start checkout";
//       payBtn.disabled = false;
//       payBtn.textContent = "Try again";
//       return;
//     }

//     // Step 2: open Razorpay's checkout widget with the order details
//     const options = {
//       key: data.keyId,
//       amount: data.amount,
//       currency: data.currency,
//       name: "CircuitCart",
//       description: "Order payment",
//       order_id: data.razorpayOrderId,
//       handler: async function (response) {
//         // Step 3: payment succeeded on Razorpay's side - now verify + save the order
//         await verifyPaymentAndPlaceOrder(response, data);
//       },
//       modal: {
//         ondismiss: function () {
//           payBtn.disabled = false;
//           payBtn.textContent = `Pay ${formatPrice(data.totalAmount)} with Razorpay`;
//         },
//       },
//       theme: { color: "#5eead4" },
//     };

//     const rzp = new Razorpay(options);
//     rzp.open();
//   } catch (err) {
//     errorEl.textContent = "Couldn't reach the server. Is the backend running?";
//     payBtn.disabled = false;
//     payBtn.textContent = "Try again";
//     console.error(err);
//   }
// }

async function handleCheckoutSubmit(e) {
  e.preventDefault();

  const errorEl = document.getElementById("form-error");
  const payBtn = document.getElementById("pay-btn");

  errorEl.textContent = "";
  payBtn.disabled = true;
  payBtn.textContent = "Preparing payment...";

  const shippingAddress = {
    line1: document.getElementById("line1").value.trim(),
    line2: document.getElementById("line2").value.trim(),
    city: document.getElementById("city").value.trim(),
    state: document.getElementById("state").value.trim(),
    postalCode: document.getElementById("postalCode").value.trim(),
    country: "India",
  };

  const chatCheckoutData = getChatCheckoutData();

  try {
    let checkoutData;

    // ============================================
    // CHATBOT CHECKOUT
    // ============================================

    if (
      chatCheckoutData?.razorpayOrderId &&
      chatCheckoutData?.orderItems
    ) {
      checkoutData = {
        ...chatCheckoutData,
        shippingAddress: shippingAddress,
      };
    }

    // ============================================
    // NORMAL WEBSITE CHECKOUT
    // ============================================

    else {
      const cart = getCachedCart();

      const items = cart.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
      }));

      const res = await fetch(
        `${API_BASE}/checkout/create-order`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders(),
          },
          body: JSON.stringify({
            items,
            shippingAddress,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        errorEl.textContent =
          data.message || "Couldn't start checkout";

        payBtn.disabled = false;
        payBtn.textContent = "Try again";

        return;
      }

      checkoutData = data;
    }

    // ============================================
    // OPEN RAZORPAY
    // ============================================

    const options = {
      key: checkoutData.keyId,

      amount: checkoutData.amount,

      currency: checkoutData.currency,

      name: "CircuitCart",

      description: "Order payment",

      order_id: checkoutData.razorpayOrderId,

      handler: async function (response) {
        await verifyPaymentAndPlaceOrder(
          response,
          checkoutData
        );
      },

      modal: {
        ondismiss: function () {
          payBtn.disabled = false;

          payBtn.textContent =
            `Pay ${formatPrice(
              checkoutData.totalAmount
            )} with Razorpay`;
        },
      },

      theme: {
        color: "#5eead4",
      },
    };

    const rzp = new Razorpay(options);

    rzp.open();

  } catch (err) {

    errorEl.textContent =
      "Couldn't reach the server. Is the backend running?";

    payBtn.disabled = false;

    payBtn.textContent = "Try again";

    console.error(err);
  }
}

async function verifyPaymentAndPlaceOrder(razorpayResponse, checkoutData) {
  const errorEl = document.getElementById("form-error");

  try {
    const res = await fetch(`${API_BASE}/checkout/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
      body: JSON.stringify({
        razorpay_order_id: razorpayResponse.razorpay_order_id,
        razorpay_payment_id: razorpayResponse.razorpay_payment_id,
        razorpay_signature: razorpayResponse.razorpay_signature,
        orderItems: checkoutData.orderItems,
        totalAmount: checkoutData.totalAmount,
        shippingAddress: checkoutData.shippingAddress,
      }),
    });
    const data = await res.json();

    if (!res.ok) {
      errorEl.textContent = data.message || "Payment verification failed";
      return;
    }

    // Order confirmed - clear cart and go to success page
    await clearCart();
    sessionStorage.removeItem(
      "circuitcart_chat_checkout"
    );
    window.location.href = `success.html?orderNumber=${data.order.orderNumber}`;
  } catch (err) {
    errorEl.textContent = "Payment succeeded but confirming the order failed. Contact support with your payment ID.";
    console.error(err);
  }
}

document.addEventListener("DOMContentLoaded", renderCheckoutForm);
