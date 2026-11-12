// Real chat widget - talks to the chatbot service (port 8000), which
// itself talks to this site's real backend for anything transactional.
// The chatbot never gets a second identity system - it just uses
// whatever token this site's normal login already stored.

const CHATBOT_API_BASE = "http://localhost:8000";
const CHAT_STORAGE_KEY = "circuitcart_chat_state";
const HARD_REFRESH_FLAG_KEY = "circuitcart_hard_refresh_pending";

// Best-effort hard-refresh detection: browsers don't expose "was this a
// hard refresh" to page JS, but we CAN catch the Ctrl+Shift+R / Cmd+Shift+R
// keyboard shortcut just before the browser reloads, and leave a flag for
// the next page load to notice. This won't catch a hard refresh triggered
// via a browser menu or DevTools - keyboard shortcut only.
window.addEventListener("keydown", (e) => {
  const isHardRefreshShortcut =
    (e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "R" || e.key === "r");
  if (isHardRefreshShortcut) {
    sessionStorage.setItem(HARD_REFRESH_FLAG_KEY, "true");
  }
});

// Chat state survives navigation between pages and normal refreshes
// (sessionStorage), but is intentionally cleared on a detected hard
// refresh, and never survives closing the tab entirely.
function loadChatState() {
  if (sessionStorage.getItem(HARD_REFRESH_FLAG_KEY)) {
    sessionStorage.removeItem(HARD_REFRESH_FLAG_KEY);
    sessionStorage.removeItem(CHAT_STORAGE_KEY);
    return { chatHistory: [], conversationHistory: [] };
  }
  try {
    const raw = sessionStorage.getItem(CHAT_STORAGE_KEY);
    if (!raw) return { chatHistory: [], conversationHistory: [] };
    return JSON.parse(raw);
  } catch (err) {
    return { chatHistory: [], conversationHistory: [] };
  }
}

function saveChatState() {
  const persistable = chatHistory.filter((m) => m.role !== "typing");
  sessionStorage.setItem(
    CHAT_STORAGE_KEY,
    JSON.stringify({ chatHistory: persistable, conversationHistory })
  );
}

const _initialState = loadChatState();
let chatHistory = _initialState.chatHistory; // for rendering the bubbles in the widget
let conversationHistory = _initialState.conversationHistory; // plain {role, content} turns the backend needs to keep memory - see main.py's ChatRequest.history

function buildChatWidgetMarkup(win) {
  win.innerHTML = `
    <div class="chatbot-header">
      <span>CircuitCart Assistant</span>
      <button class="chatbot-close-btn" id="chatbot-close-btn" aria-label="Close chat">&times;</button>
    </div>
    <div class="chatbot-messages" id="chatbot-messages">
      <div class="chatbot-empty">Ask me about products, your cart, or orders 👋</div>
    </div>
    <div class="chatbot-input-row">
      <input type="text" id="chatbot-input" placeholder="Type a message..." />
      <button class="chatbot-send-btn" id="chatbot-send-btn">Send</button>
    </div>
  `;
}

function renderMessages() {
  const container = document.getElementById("chatbot-messages");
  if (!container) return;

  if (!chatHistory.length) {
    container.innerHTML = `<div class="chatbot-empty">Ask me about products, your cart, or orders 👋</div>`;
    saveChatState();
    return;
  }

  container.innerHTML = chatHistory
    .map((msg) => {
      if (msg.role === "typing") {
        return `<div class="chat-bubble assistant typing">Thinking...</div>`;
      }

      let html = `<div class="chat-bubble ${msg.role}">${
        msg.role === "assistant" ? renderMarkdownLite(msg.text) : escapeHtml(msg.text)
      }</div>`;

      // Real product cards from actual backend data - never parsed from
      // the AI's prose, always the structured `products` field.
      if (msg.products && msg.products.length) {
        html += renderProductCards(msg.products);
      }

      if (msg.action) {
        html += renderActionButton(msg.action);
      }
      return html;
    })
    .join("");

  container.scrollTop = container.scrollHeight;
  saveChatState();
}

function renderActionButton(action) {
  if (action.type === "OPEN_LOGIN") {
    return `<button class="chat-action-btn" onclick="window.location.href='login.html?next=${encodeURIComponent(window.location.pathname.split("/").pop())}'">Log in</button>`;
  }
  if (action.type === "OPEN_CHECKOUT") {
    // The real Razorpay widget lives on checkout.html - we hand off
    // there rather than reimplementing payment inside the chat window.
    return `<button class="chat-action-btn" onclick="openCheckoutFromChat()">Proceed to payment</button>`;
  }
  return "";
}

function openCheckoutFromChat() {
  const lastAction = [...chatHistory]
    .reverse()
    .find((msg) => msg.action?.type === "OPEN_CHECKOUT");

  if (!lastAction?.action?.checkout_data) {
    window.location.href = "checkout.html";
    return;
  }

  sessionStorage.setItem(
    "circuitcart_chat_checkout",
    JSON.stringify(lastAction.action.checkout_data)
  );

  window.location.href = "checkout.html?from=chatbot";
}

// ========================================
// Product cards - real data, real buttons.
// Internal DB IDs are used for the buttons' logic but never displayed.
// ========================================
function renderProductCards(products) {
  return `<div class="chat-products">${products.map(renderOneProductCard).join("")}</div>`;
}

const SPEC_LABEL_OVERRIDES = { rgb: "RGB", dpi: "DPI" };

function formatSpecForCard(key, value) {
  const k = key.toLowerCase();
  if (typeof value === "boolean") {
    // Only show positive booleans as a label (e.g. "Wireless") - a false
    // value like "noiseCancelling: false" isn't worth cluttering the card.
    return value ? SPEC_LABEL_OVERRIDES[k] || formatSpecLabel(key) : null;
  }
  if (k === "dpi") return `${Number(value).toLocaleString()} DPI`;
  if (k === "buttons") return `${value} buttons`;
  return String(value);
}

function renderOneProductCard(p) {
  const image =
    p.images && p.images[0]
      ? p.images[0]
      : "https://placehold.co/300x300/131b2e/5eead4?text=No+Image";
  const specsLine = p.specs
    ? Object.entries(p.specs)
        .map(([key, value]) => formatSpecForCard(key, value))
        .filter(Boolean)
        .slice(0, 4)
        .join(" • ")
    : "";
  const outOfStock = !p.stock || p.stock <= 0;

  return `
    <div class="chat-product-card">
      <img src="${escapeAttr(image)}" alt="${escapeAttr(p.name)}" class="chat-product-image" />
      <div class="chat-product-body">
        <div class="chat-product-name">${escapeHtml(p.name)}</div>
        <div class="chat-product-price">${formatPrice(p.price)}</div>
        ${specsLine ? `<div class="chat-product-specs">${escapeHtml(specsLine)}</div>` : ""}
        <div class="chat-product-stock ${outOfStock ? "out" : ""}">${
          outOfStock ? "Out of stock" : `${p.stock} in stock`
        }</div>
        <div class="chat-product-actions">
          <button class="chat-product-btn secondary" onclick="window.location.href='product.html?id=${p._id}'">View Details</button>
          <button class="chat-product-btn primary" ${outOfStock ? "disabled" : ""} onclick="handleChatAddToCart('${p._id}', this)">Add to Cart</button>
        </div>
      </div>
    </div>
  `;
}

// Called from an inline button click - real API call (same addToCart used
// by the rest of the site), with double-click protection and login handoff
// through the site's existing login flow (no second auth system).
async function handleChatAddToCart(productId, btnEl) {
  if (btnEl.disabled) return;

  if (!isLoggedIn()) {
    btnEl.textContent = "Log in first";
    setTimeout(() => {
      window.location.href = `login.html?next=${encodeURIComponent(window.location.pathname.split("/").pop())}`;
    }, 600);
    return;
  }

  const original = btnEl.textContent;
  btnEl.disabled = true;
  btnEl.textContent = "Adding...";

  const result = await addToCart(productId, 1);

  if (result.error) {
    btnEl.textContent = "Couldn't add";
    setTimeout(() => {
      btnEl.textContent = original;
      btnEl.disabled = false;
    }, 1500);
    return;
  }

  btnEl.textContent = "Added ✓";
  await fetchCart();
  updateCartBadge();
  setTimeout(() => {
    btnEl.textContent = original;
    btnEl.disabled = false;
  }, 1200);
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Same escaping, plus quote-safe for use inside HTML attributes (src=""/alt="")
function escapeAttr(text) {
  return escapeHtml(text).replace(/"/g, "&quot;");
}

// Purpose-built markdown renderer for chat bubbles - handles bold, bullet
// lists, line breaks, inline code, AND markdown tables (rendered as real
// <table> elements, not raw pipe characters). We escape HTML FIRST so
// nothing from the AI's text can inject real markup, then apply
// formatting on top of the already-safe text.
function renderMarkdownLite(rawText) {
  // Some models occasionally emit a literal backslash before a pipe
  // inside table rows - normalize that away before parsing.
  const cleaned = rawText.replace(/\\\|/g, "|");
  const escaped = escapeHtml(cleaned);
  const lines = escaped.split("\n");

  const isTableRow = (line) => /^\|.*\|$/.test(line.trim());
  const isSeparatorRow = (line) =>
    /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?$/.test(line.trim());

  let html = "";
  let inList = false;
  let i = 0;

  while (i < lines.length) {
    const trimmed = lines[i].trim();

    // Markdown table: this line + the next look like a header + separator
    if (isTableRow(trimmed) && lines[i + 1] && isSeparatorRow(lines[i + 1])) {
      const headerCells = parseTableRow(trimmed);
      const bodyRows = [];
      let j = i + 2;
      while (j < lines.length && isTableRow(lines[j].trim())) {
        bodyRows.push(parseTableRow(lines[j].trim()));
        j++;
      }
      html += renderTable(headerCells, bodyRows);
      i = j;
      continue;
    }

    const isBullet = /^[-*]\s+/.test(trimmed);
    if (isBullet) {
      if (!inList) {
        html += "<ul>";
        inList = true;
      }
      html += `<li>${formatInline(trimmed.replace(/^[-*]\s+/, ""))}</li>`;
    } else {
      if (inList) {
        html += "</ul>";
        inList = false;
      }
      if (trimmed) {
        html += `<p>${formatInline(trimmed)}</p>`;
      }
    }
    i++;
  }
  if (inList) html += "</ul>";

  return html;
}

function parseTableRow(line) {
  const inner = line.replace(/^\|/, "").replace(/\|$/, "");
  return inner.split("|").map((c) => c.trim());
}

function renderTable(headerCells, bodyRows) {
  const thead = `<tr>${headerCells.map((c) => `<th>${formatInline(c)}</th>`).join("")}</tr>`;
  const tbody = bodyRows
    .map((row) => `<tr>${row.map((c) => `<td>${formatInline(c)}</td>`).join("")}</tr>`)
    .join("");
  return `<div class="chat-table-wrap"><table class="chat-table"><thead>${thead}</thead><tbody>${tbody}</tbody></table></div>`;
}

function formatInline(text) {
  // **bold** -> <strong>, `code` -> <code>
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`(.+?)`/g, "<code>$1</code>");
}

async function sendChatMessage(message) {
  chatHistory.push({ role: "user", text: message });
  chatHistory.push({ role: "typing" });
  renderMessages();

  try {
    const res = await fetch(`${CHATBOT_API_BASE}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, token: getToken(), history: conversationHistory }),
    });
    const data = await res.json();

    // The backend has no session/DB of its own - it echoes back the full
    // running history (previous turns + this one) and expects us to send
    // that same array back on the NEXT call.
    conversationHistory = data.history || conversationHistory;

    chatHistory.pop(); // remove "typing"
    chatHistory.push({
      role: "assistant",
      text: data.reply,
      action: data.action,
      products: data.products,
    });

    // The chatbot may have changed the REAL cart (e.g. "add this to my
    // cart" handled entirely by the AI, not a card button click). Re-sync
    // the site's cart badge from the actual server state either way - the
    // backend stays the single source of truth, never a locally-guessed one.
    if (data.cart) {
      await fetchCart();
      updateCartBadge();
    }

    if (data.action?.type === "OPEN_CHECKOUT" && data.action.checkout_data) {
      sessionStorage.setItem(
        "circuitcart_chat_checkout",
        JSON.stringify(data.action.checkout_data)
      );
      window.location.href = "checkout.html?from=chatbot";
      return;
    }
  } catch (err) {
    chatHistory.pop();
    chatHistory.push({
      role: "assistant",
      text: "Sorry, I couldn't reach the assistant service. Is it running?",
    });
    console.error(err);
  }

  renderMessages();
}

document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.getElementById("chatbot-toggle");
  const win = document.getElementById("chatbot-window");
  if (!toggle || !win) return;

  buildChatWidgetMarkup(win);
  renderMessages(); // show any conversation restored from sessionStorage

  toggle.addEventListener("click", (e) => {
    e.stopPropagation();
    win.classList.toggle("open");
  });

  document.getElementById("chatbot-close-btn").addEventListener("click", () => {
    win.classList.remove("open");
  });

  // Click anywhere outside the widget closes it
  document.addEventListener("click", (e) => {
    if (!win.classList.contains("open")) return;
    if (win.contains(e.target) || toggle.contains(e.target)) return;
    win.classList.remove("open");
  });

  const input = document.getElementById("chatbot-input");
  const sendBtn = document.getElementById("chatbot-send-btn");

  const handleSend = () => {
    const message = input.value.trim();
    if (!message) return;
    input.value = "";
    sendBtn.disabled = true;
    sendChatMessage(message).finally(() => {
      sendBtn.disabled = false;
      input.focus();
    });
  };

  sendBtn.addEventListener("click", handleSend);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleSend();
  });
});