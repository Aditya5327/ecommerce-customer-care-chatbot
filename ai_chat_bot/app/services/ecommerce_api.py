"""
Talks to the existing Node/Express ecommerce backend. The chatbot has
NO login system of its own - it just forwards whatever JWT the frontend
already has (from the site's normal login) and asks the real backend
"who is this, if anyone?"

This is the one function every private tool will eventually depend on.
If this returns None, no private tool should be allowed to run.
"""

import httpx
from app.config import NODE_BACKEND_URL


def get_current_user(token: str | None) -> dict | None:
    """
    Returns the authenticated user's safe info (id, name, email, role)
    if the token is valid, or None if there's no token or it's invalid/
    expired. Never raises - a bad token just means "not logged in",
    not a crash.
    """
    if not token:
        return None

    try:
        response = httpx.get(
            f"{NODE_BACKEND_URL}/auth/me",
            headers={"Authorization": f"Bearer {token}"},
            timeout=5.0,
        )
        if response.status_code != 200:
            return None
        return response.json()
    except httpx.RequestError:
        # Node backend unreachable - treat as "not logged in" rather
        # than crashing the whole chat request
        return None


def _auth_headers(token: str | None) -> dict:
    return {"Authorization": f"Bearer {token}"} if token else {}


def _handle_response(response: httpx.Response) -> dict:
    """
    Every tool call ends up here. We never let an HTTP error crash the
    chat request - instead we return a structured error dict the LLM can
    read and explain to the user in plain language.
    """
    try:
        data = response.json()
    except Exception:
        data = {}

    if response.status_code >= 400:
        return {
            "success": False,
            "error": data.get("message", f"Request failed ({response.status_code})"),
        }
    return {"success": True, "data": data}


# ---------- Products (public - no token needed) ----------

def search_products(category: str | None = None, search: str | None = None,
                     min_price: float | None = None, max_price: float | None = None) -> dict:
    params = {}
    if category:
        params["category"] = category
    if search:
        params["search"] = search
    if min_price is not None:
        params["minPrice"] = min_price
    if max_price is not None:
        params["maxPrice"] = max_price

    try:
        response = httpx.get(f"{NODE_BACKEND_URL}/products", params=params, timeout=5.0)
        return _handle_response(response)
    except httpx.RequestError as e:
        return {"success": False, "error": f"Couldn't reach the store backend: {e}"}


def get_product_details(product_id: str) -> dict:
    try:
        response = httpx.get(f"{NODE_BACKEND_URL}/products/{product_id}", timeout=5.0)
        return _handle_response(response)
    except httpx.RequestError as e:
        return {"success": False, "error": f"Couldn't reach the store backend: {e}"}


# ---------- Cart (private - requires a valid token) ----------

def get_cart(token: str) -> dict:
    try:
        response = httpx.get(
            f"{NODE_BACKEND_URL}/cart", headers=_auth_headers(token), timeout=5.0
        )
        return _handle_response(response)
    except httpx.RequestError as e:
        return {"success": False, "error": f"Couldn't reach the store backend: {e}"}


def add_to_cart(token: str, product_id: str, quantity: int = 1) -> dict:
    try:
        response = httpx.post(
            f"{NODE_BACKEND_URL}/cart/items",
            headers=_auth_headers(token),
            json={"productId": product_id, "quantity": quantity},
            timeout=5.0,
        )
        return _handle_response(response)
    except httpx.RequestError as e:
        return {"success": False, "error": f"Couldn't reach the store backend: {e}"}


def update_cart_quantity(token: str, product_id: str, quantity: int) -> dict:
    try:
        response = httpx.put(
            f"{NODE_BACKEND_URL}/cart/items/{product_id}",
            headers=_auth_headers(token),
            json={"quantity": quantity},
            timeout=5.0,
        )
        return _handle_response(response)
    except httpx.RequestError as e:
        return {"success": False, "error": f"Couldn't reach the store backend: {e}"}


def remove_from_cart(token: str, product_id: str) -> dict:
    try:
        response = httpx.delete(
            f"{NODE_BACKEND_URL}/cart/items/{product_id}",
            headers=_auth_headers(token),
            timeout=5.0,
        )
        return _handle_response(response)
    except httpx.RequestError as e:
        return {"success": False, "error": f"Couldn't reach the store backend: {e}"}


# ---------- Orders (private - requires a valid token) ----------

def get_my_orders(token: str) -> dict:
    try:
        response = httpx.get(
            f"{NODE_BACKEND_URL}/orders", headers=_auth_headers(token), timeout=5.0
        )
        return _handle_response(response)
    except httpx.RequestError as e:
        return {"success": False, "error": f"Couldn't reach the store backend: {e}"}


def track_order(token: str, order_number: str) -> dict:
    # Your orders route accepts either a Mongo _id or a 6-digit orderNumber -
    # we always pass the customer-facing number here, never a Mongo ID.
    try:
        response = httpx.get(
            f"{NODE_BACKEND_URL}/orders/{order_number}",
            headers=_auth_headers(token),
            timeout=5.0,
        )
        return _handle_response(response)
    except httpx.RequestError as e:
        return {"success": False, "error": f"Couldn't reach the store backend: {e}"}


def cancel_order(token: str, order_number: str) -> dict:
    # Business rules (can this order actually be cancelled?) live entirely
    # in the Node backend - this function just relays whatever it decides.
    try:
        response = httpx.patch(
            f"{NODE_BACKEND_URL}/orders/{order_number}/cancel",
            headers=_auth_headers(token),
            timeout=5.0,
        )
        return _handle_response(response)
    except httpx.RequestError as e:
        return {"success": False, "error": f"Couldn't reach the store backend: {e}"}


# ---------- Checkout (private - requires a valid token) ----------

def initiate_checkout(token: str, shipping_address: dict) -> dict:
    """
    Prepares a real Razorpay order from whatever's in the user's actual
    server-side cart (we don't pass items - the backend already knows
    how to pull from the real cart, same as the website does). Returns
    the real payment details needed to open the Razorpay widget - the
    chatbot itself never touches card/UPI details.
    """
    try:
        response = httpx.post(
            f"{NODE_BACKEND_URL}/checkout/create-order",
            headers=_auth_headers(token),
            json={"shippingAddress": shipping_address},
            timeout=10.0,
        )
        return _handle_response(response)
    except httpx.RequestError as e:
        return {"success": False, "error": f"Couldn't reach the store backend: {e}"}


def request_return(token: str, order_number: str, reason: str) -> dict:
    # Eligibility (must be "delivered") is enforced entirely by the Node
    # backend - this just relays whatever it decides.
    try:
        response = httpx.patch(
            f"{NODE_BACKEND_URL}/orders/{order_number}/return",
            headers=_auth_headers(token),
            json={"reason": reason},
            timeout=5.0,
        )
        return _handle_response(response)
    except httpx.RequestError as e:
        return {"success": False, "error": f"Couldn't reach the store backend: {e}"}


def get_refund_status(token: str, order_number: str) -> dict:
    try:
        response = httpx.get(
            f"{NODE_BACKEND_URL}/orders/{order_number}/refund",
            headers=_auth_headers(token),
            timeout=5.0,
        )
        return _handle_response(response)
    except httpx.RequestError as e:
        return {"success": False, "error": f"Couldn't reach the store backend: {e}"}


# ---------- Support tickets (private - requires a valid token) ----------

def create_ticket(token: str, issue: str, order_number: str | None = None) -> dict:
    try:
        body = {"issue": issue}
        if order_number:
            body["orderNumber"] = order_number
        response = httpx.post(
            f"{NODE_BACKEND_URL}/tickets",
            headers=_auth_headers(token),
            json=body,
            timeout=5.0,
        )
        result = _handle_response(response)

        # The Node backend silently creates the ticket even if the given
        # order number doesn't match a real order of this user's (it just
        # doesn't link it) - so we make that explicit here rather than
        # letting the model assume/claim the link succeeded when it didn't.
        if result.get("success") and order_number:
            linked = bool(result["data"]["ticket"].get("order"))
            result["data"]["order_number_was_linked"] = linked
            if not linked:
                result["data"]["note"] = (
                    f"Order number {order_number} was NOT found on this account "
                    "- the ticket was created without linking to any order. "
                    "Tell the user this clearly, don't claim it was linked."
                )

        return result
    except httpx.RequestError as e:
        return {"success": False, "error": f"Couldn't reach the store backend: {e}"}


def get_my_tickets(token: str) -> dict:
    try:
        response = httpx.get(
            f"{NODE_BACKEND_URL}/tickets", headers=_auth_headers(token), timeout=5.0
        )
        return _handle_response(response)
    except httpx.RequestError as e:
        return {"success": False, "error": f"Couldn't reach the store backend: {e}"}


def get_ticket(token: str, ticket_number: str) -> dict:
    try:
        response = httpx.get(
            f"{NODE_BACKEND_URL}/tickets/{ticket_number}",
            headers=_auth_headers(token),
            timeout=5.0,
        )
        return _handle_response(response)
    except httpx.RequestError as e:
        return {"success": False, "error": f"Couldn't reach the store backend: {e}"}
