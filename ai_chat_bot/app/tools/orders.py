"""
Order tools. All require login - orders are always someone's own private
data. Note: business rules (can THIS order be cancelled right now?) are
never decided here or by the LLM - track_order and cancel_order just
relay whatever the real Node backend decides.
"""

from app.services import ecommerce_api

TOOLS = [
    {
        "name": "get_my_orders",
        "description": "Get the logged-in user's order history - all past and current orders.",
        "parameters": {"type": "object", "properties": {}, "required": []},
        "requires_auth": True,
        "executor": lambda token, **kwargs: ecommerce_api.get_my_orders(token),
    },
    {
        "name": "track_order",
        "description": (
            "Look up ONE specific order by its 6-digit order number (e.g. 583214) "
            "to check its status, items, and delivery progress. Always use the "
            "order number the customer gives, never a database ID."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "order_number": {
                    "type": "string",
                    "description": "The 6-digit customer-facing order number",
                },
            },
            "required": ["order_number"],
        },
        "requires_auth": True,
        "executor": lambda token, **kwargs: ecommerce_api.track_order(token, **kwargs),
    },
    {
        "name": "cancel_order",
        "description": (
            "Cancel an order by its 6-digit order number. Only works if the order "
            "hasn't shipped yet - the backend enforces this, not you. Always confirm "
            "with the user before calling this - never cancel without explicit intent."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "order_number": {
                    "type": "string",
                    "description": "The 6-digit customer-facing order number",
                },
            },
            "required": ["order_number"],
        },
        "requires_auth": True,
        "executor": lambda token, **kwargs: ecommerce_api.cancel_order(token, **kwargs),
    },
    {
        "name": "return_order",
        "description": (
            "Request a return for an order by its 6-digit order number. Only works "
            "if the order has been delivered - the backend enforces this, not you. "
            "Always ask for a reason if the user hasn't given one, and confirm "
            "before calling this - never return without explicit intent."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "order_number": {
                    "type": "string",
                    "description": "The 6-digit customer-facing order number",
                },
                "reason": {
                    "type": "string",
                    "description": "Why the customer wants to return this order",
                },
            },
            "required": ["order_number", "reason"],
        },
        "requires_auth": True,
        "executor": lambda token, **kwargs: ecommerce_api.request_return(token, **kwargs),
    },
    {
        "name": "get_refund_status",
        "description": (
            "Check the refund status for an order by its 6-digit order number - "
            "whether a refund has been initiated, is processing, or completed."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "order_number": {
                    "type": "string",
                    "description": "The 6-digit customer-facing order number",
                },
            },
            "required": ["order_number"],
        },
        "requires_auth": True,
        "executor": lambda token, **kwargs: ecommerce_api.get_refund_status(token, **kwargs),
    },
    {
        "name": "buy_again",
        "description": (
            "Re-add all items from a past order (by its 6-digit order number) back "
            "into the user's current cart, so they can quickly reorder something "
            "they bought before. Always confirm which order first if the user just "
            "says 'buy again' without specifying - use get_my_orders to help them "
            "pick if needed."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "order_number": {
                    "type": "string",
                    "description": "The 6-digit order number to reorder items from",
                },
            },
            "required": ["order_number"],
        },
        "requires_auth": True,
        "executor": lambda token, **kwargs: _buy_again(token, **kwargs),
    },
]


def _buy_again(token: str, order_number: str) -> dict:
    """
    Composed action: look up the past order, then add each of its items
    back into the current cart one by one. Reports which items made it
    in and which didn't (e.g. now out of stock or discontinued) rather
    than failing the whole thing on one bad item.
    """
    order_result = ecommerce_api.track_order(token, order_number)
    if not order_result.get("success"):
        return order_result

    items = order_result["data"].get("items", [])
    if not items:
        return {"success": False, "error": "That order has no items to reorder."}

    added, failed = [], []
    for item in items:
        add_result = ecommerce_api.add_to_cart(
            token, product_id=item["product"], quantity=item["quantity"]
        )
        if add_result.get("success"):
            added.append(item["name"])
        else:
            failed.append({"name": item["name"], "reason": add_result.get("error")})

    return {
        "success": True,
        "data": {
            "added_to_cart": added,
            "could_not_add": failed,
        },
    }
