"""
Cart tools. All four require a logged-in user, per the spec's rule that
private data always needs real authentication - the LLM never gets to
decide "user_id=123", it always operates on whoever the verified token
belongs to.
"""

from app.services import ecommerce_api

TOOLS = [
    {
        "name": "get_cart",
        "description": "View the current logged-in user's cart: items, quantities, prices, and total.",
        "parameters": {"type": "object", "properties": {}, "required": []},
        "requires_auth": True,
        "executor": lambda token, **kwargs: ecommerce_api.get_cart(token),
    },
    {
        "name": "add_to_cart",
        "description": (
            "Add a product to the logged-in user's cart, or increase its quantity if "
            "already there. Always confirm which exact product (by ID) before calling "
            "this if there's any ambiguity - never guess between multiple matches."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "product_id": {"type": "string", "description": "The product's ID"},
                "quantity": {"type": "integer", "description": "How many to add (default 1)"},
            },
            "required": ["product_id"],
        },
        "requires_auth": True,
        "executor": lambda token, **kwargs: ecommerce_api.add_to_cart(token, **kwargs),
    },
    {
        "name": "update_cart_quantity",
        "description": "Change the quantity of a product already in the logged-in user's cart.",
        "parameters": {
            "type": "object",
            "properties": {
                "product_id": {"type": "string", "description": "The product's ID"},
                "quantity": {"type": "integer", "description": "New quantity (must be at least 1)"},
            },
            "required": ["product_id", "quantity"],
        },
        "requires_auth": True,
        "executor": lambda token, **kwargs: ecommerce_api.update_cart_quantity(token, **kwargs),
    },
    {
        "name": "remove_from_cart",
        "description": "Remove a product entirely from the logged-in user's cart.",
        "parameters": {
            "type": "object",
            "properties": {
                "product_id": {"type": "string", "description": "The product's ID"},
            },
            "required": ["product_id"],
        },
        "requires_auth": True,
        "executor": lambda token, **kwargs: ecommerce_api.remove_from_cart(token, **kwargs),
    },
]
