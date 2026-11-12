"""
Support ticket tools. All require login - tickets always belong to a
specific user.
"""

from app.services import ecommerce_api

TOOLS = [
    {
        "name": "create_support_ticket",
        "description": (
            "Create a support ticket describing an issue the user is having (e.g. "
            "damaged product, missing item, billing question). If the issue relates "
            "to a specific order, include its 6-digit order number. Always confirm "
            "with the user before creating a ticket."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "issue": {
                    "type": "string",
                    "description": "Description of the problem",
                },
                "order_number": {
                    "type": "string",
                    "description": "The related 6-digit order number, if applicable",
                },
            },
            "required": ["issue"],
        },
        "requires_auth": True,
        "executor": lambda token, **kwargs: ecommerce_api.create_ticket(token, **kwargs),
    },
    {
        "name": "get_my_support_tickets",
        "description": "List all of the logged-in user's support tickets and their statuses.",
        "parameters": {"type": "object", "properties": {}, "required": []},
        "requires_auth": True,
        "executor": lambda token, **kwargs: ecommerce_api.get_my_tickets(token),
    },
    {
        "name": "get_support_ticket",
        "description": "Look up ONE specific support ticket by its ticket number (e.g. TCK-A1B2C3D4).",
        "parameters": {
            "type": "object",
            "properties": {
                "ticket_number": {
                    "type": "string",
                    "description": "The ticket number, e.g. TCK-A1B2C3D4",
                },
            },
            "required": ["ticket_number"],
        },
        "requires_auth": True,
        "executor": lambda token, **kwargs: ecommerce_api.get_ticket(token, **kwargs),
    },
]
