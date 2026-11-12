"""
Checkout tool. This does NOT process payment - it prepares a real
Razorpay order from the user's real server-side cart, exactly like
clicking "Proceed to checkout" on the website does. The actual payment
still happens in the real Razorpay widget (a later step wires this into
the chat UI so it can open that widget directly).

The chatbot NEVER asks for card numbers, CVV, OTP, or UPI PINs - it only
ever hands off to the real payment system, per the login-is-a-UI-action
principle applied the same way to payment.
"""

from app.services import ecommerce_api

TOOLS = [
    {
        "name": "initiate_checkout",
        "description": (
            "Start real checkout for the logged-in user's current cart. Before "
            "calling this, always show the user their cart summary (items, "
            "quantities, total) and get explicit confirmation they want to "
            "proceed - never call this just because a product was mentioned. "
            "Requires a shipping address - ask for it if not already known."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "line1": {"type": "string", "description": "Address line 1"},
                "line2": {"type": "string", "description": "Address line 2 (optional)"},
                "city": {"type": "string", "description": "City"},
                "state": {"type": "string", "description": "State"},
                "postal_code": {"type": "string", "description": "Postal/PIN code"},
            },
            "required": ["line1", "city", "state", "postal_code"],
        },
        "requires_auth": True,
        "executor": lambda token, **kwargs: _execute_checkout(token, **kwargs),
    },
]


def _execute_checkout(token: str, line1: str, city: str, state: str,
                       postal_code: str, line2: str = "") -> dict:
    shipping_address = {
        "line1": line1,
        "line2": line2,
        "city": city,
        "state": state,
        "postalCode": postal_code,
        "country": "India",
    }

    result = ecommerce_api.initiate_checkout(token, shipping_address)

    if not result.get("success"):
        return result  # pass the real error straight through

    checkout_data = result["data"]
    # Structured action a future chat widget will use to actually open the
    # real Razorpay popup - the LLM just describes this in words for now.
    return {
        "success": True,
        "message": (
            f"Checkout started. Total: {checkout_data.get('totalAmount')} INR. "
            "The customer needs to complete payment in the secure checkout page."
        ),
        "action": {
            "type": "OPEN_CHECKOUT",
            "checkout_data": checkout_data,
        },
    }
