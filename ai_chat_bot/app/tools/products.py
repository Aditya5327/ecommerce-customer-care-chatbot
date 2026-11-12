"""
Product tools. Both are public - guests can search and view products
without logging in, matching the spec's rule that product browsing
doesn't require authentication.
"""

from app.services import ecommerce_api

TOOLS = [
    {
        "name": "search_products",
        "description": (
            "Search the real product catalog by category, keyword, and/or price range. "
            "Always use this instead of guessing when someone asks about products, "
            "prices, or stock. Never invent products or prices."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "category": {
                    "type": "string",
                    "enum": ["laptop", "mouse", "keyboard", "headphones", "other"],
                    "description": "Filter by product category",
                },
                "search": {
                    "type": "string",
                    "description": "Keyword to search in product name or description",
                },
                "min_price": {"type": "number", "description": "Minimum price in INR"},
                "max_price": {"type": "number", "description": "Maximum price in INR"},
            },
            "required": [],
        },
        "requires_auth": False,
        "executor": lambda token, **kwargs: ecommerce_api.search_products(**kwargs),
    },
    {
        "name": "get_product_details",
        "description": (
            "Get full details (price, stock, specs, description) for ONE specific "
            "product by its product ID. Use this when the user asks about a specific "
            "product already found via search_products."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "product_id": {"type": "string", "description": "The product's ID"},
            },
            "required": ["product_id"],
        },
        "requires_auth": False,
        "executor": lambda token, **kwargs: ecommerce_api.get_product_details(**kwargs),
    },
]
