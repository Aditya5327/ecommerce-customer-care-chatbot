from typing import Optional
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.llm_client import run_with_tools
from app.config import LLM_PROVIDER
from app.services.ecommerce_api import get_current_user
from app.tools import products as product_tools
from app.tools import cart as cart_tools
from app.tools import orders as order_tools
from app.tools import checkout as checkout_tools
from app.tools import knowledge as knowledge_tools
from app.tools import tickets as ticket_tools

app = FastAPI(title="CircuitCart Chatbot")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# All tools currently available to the agent. Any new tool group just
# gets added to this list - nothing else needs to change for the agent
# to start using it.
ALL_TOOLS = (
    product_tools.TOOLS
    + cart_tools.TOOLS
    + order_tools.TOOLS
    + checkout_tools.TOOLS
    + knowledge_tools.TOOLS
    + ticket_tools.TOOLS
)


class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class ChatRequest(BaseModel):
    message: str
    token: Optional[str] = None
    # Prior turns of THIS conversation, oldest first. The backend is
    # stateless - it has no session/DB of its own - so the frontend is
    # responsible for storing the `history` returned in each ChatResponse
    # and sending it back on the next call. Without this, every message
    # looks like a brand new conversation to the LLM (e.g. a bare "yes"
    # confirming checkout would mean nothing).
    history: list[ChatMessage] = []


class ChatResponse(BaseModel):
    reply: str
    authenticated: bool
    user_name: Optional[str] = None
    action: Optional[dict] = None  # e.g. {"type": "OPEN_CHECKOUT", "checkout_data": {...}}
    tools_used: list[str] = []  # e.g. ["search_store_knowledge"] for RAG, [] for plain chat
    # NEW: structured data for the frontend to render as real UI instead of
    # parsing the LLM's prose. Populated only when a relevant tool actually
    # ran this turn - both are None on plain chat turns.
    products: Optional[list] = None  # from search_products / get_product_details
    cart: Optional[dict] = None      # from get_cart / add_to_cart / update_cart_quantity / remove_from_cart
    # Updated history (previous history + this turn) - send this back as
    # `history` on the NEXT request to this endpoint.
    history: list[ChatMessage] = []


@app.get("/")
def health_check():
    return {"status": "Chatbot service is running", "llm_provider": LLM_PROVIDER}


def _extract_products(tool_calls: list[dict]) -> Optional[list]:
    """
    Finds the most recent successful search_products or get_product_details
    call and returns its product data, so the frontend can render real
    cards instead of the LLM describing products in prose alone.
    """
    for entry in reversed(tool_calls):
        if not entry["result"].get("success"):
            continue
        if entry["name"] == "search_products":
            data = entry["result"].get("data")
            return data if isinstance(data, list) else None
        if entry["name"] == "get_product_details":
            data = entry["result"].get("data")
            return [data] if data else None
    return None


def _extract_cart(tool_calls: list[dict]) -> Optional[dict]:
    """
    Finds the most recent successful cart-related call and returns the
    resulting cart state, so the frontend can sync the site's cart badge
    and show a real cart summary without a separate round-trip.
    """
    cart_tool_names = {"get_cart", "add_to_cart", "update_cart_quantity", "remove_from_cart"}
    for entry in reversed(tool_calls):
        if entry["name"] in cart_tool_names and entry["result"].get("success"):
            return entry["result"].get("data")
    return None


class DebugCancelRequest(BaseModel):
    token: str
    order_number: str


@app.post("/debug/cancel-test")
def debug_cancel_test(request: DebugCancelRequest):
    """
    TEMPORARY - same idea as /debug/checkout-test, but for cancel_order.
    """
    from app.services.ecommerce_api import cancel_order

    return cancel_order(request.token, request.order_number)


class DebugCheckoutRequest(BaseModel):
    token: str
    line1: str
    city: str
    state: str
    postal_code: str
    line2: str = ""


@app.post("/debug/checkout-test")
def debug_checkout_test(request: DebugCheckoutRequest):
    """
    TEMPORARY - calls the checkout tool's real code directly, skipping
    the LLM entirely. Lets us confirm the tool's actual plumbing works
    (real cart -> real Razorpay order) independent of whether the model
    decides to call it. Safe to delete once we're confident in the tool.
    """
    from app.tools.checkout import _execute_checkout

    return _execute_checkout(
        token=request.token,
        line1=request.line1,
        line2=request.line2,
        city=request.city,
        state=request.state,
        postal_code=request.postal_code,
    )


@app.post("/chat", response_model=ChatResponse)
def chat(request: ChatRequest):
    """
    Step 6-8: order history, order tracking, order cancellation, and
    checkout handoff. Cancellation eligibility and checkout totals are
    always decided by the real Node backend - never by the LLM.
    """
    user = get_current_user(request.token)
    authenticated = user is not None

    if user:
        system_prompt = (
            "You are the CircuitCart AI assistant, a shopping helper for an "
            f"electronics store. The person you're talking to is logged in "
            f"as {user['name']}. Greet them by name naturally, not every message. "
            "For general chat (hello, thanks, bye, what can you do), just reply "
            "naturally without using any tool. For general policy questions "
            "(shipping time, return policy, warranty, payment methods), use "
            "search_store_knowledge - and when you use its results, state ONLY "
            "what they actually say, never add typical/generic policy details "
            "that aren't in the retrieved text. For anything about THIS user's own products, "
            "cart, or orders, use the real product/cart/order tools instead - "
            "never answer those from general knowledge. Always show a clear "
            "summary (items, quantities, total) and get explicit confirmation "
            "before cancelling an order, returning an order, creating a support "
            "ticket, or starting checkout - never do any of these just because "
            "a product or order was mentioned in passing. Never "
            "invent product names, prices, stock, or order statuses - only use "
            "what the tools actually return. If a tool result includes a note "
            "saying something wasn't linked/found/matched, always say so clearly "
            "- never state a match happened when the tool result didn't confirm "
            "it. If the user already gave information earlier in this "
            "conversation (like an order number), use it - don't ask for the "
            "same thing again unless it's genuinely unclear which one they mean. "
            "You only help with CircuitCart "
            "shopping - products, cart, orders, checkout, and store policies. "
            "If asked something unrelated (general knowledge, other topics, "
            "people, news, coding help, etc.), politely say that's outside "
            "what you can help with here and steer the conversation back to "
            "shopping - do not answer it, even if you know the answer. When "
            "you find products via search_products or get_product_details, "
            "the actual product cards (image, price, specs, buttons) are "
            "shown separately by the app - so keep your own text brief and "
            "natural (e.g. \"Here are a few laptops that fit\"), and NEVER "
            "mention product IDs, database IDs, or any internal identifiers "
            "in your reply."
        )
    else:
        system_prompt = (
            "You are the CircuitCart AI assistant, a shopping helper for an "
            "electronics store. The person you're talking to is a guest (not "
            "logged in). For general chat, just reply naturally without any "
            "tool. For policy questions (shipping, returns, warranty, payment), "
            "use search_store_knowledge - and when you use its results, state "
            "ONLY what they actually say, never add typical/generic policy "
            "details that aren't in the retrieved text. You can help guests search and browse "
            "products freely. If they ask about their cart, orders, or checkout, "
            "tell them to log in first - do not attempt those actions for a "
            "guest. Never invent product names, prices, or stock. You only "
            "help with CircuitCart shopping - products, store policies, and "
            "(once logged in) cart/orders/checkout. If asked something "
            "unrelated (general knowledge, other topics, people, news, coding "
            "help, etc.), politely say that's outside what you can help with "
            "here and steer the conversation back to shopping - do not answer "
            "it, even if you know the answer. When you find products via "
            "search_products or get_product_details, the actual product "
            "cards (image, price, specs, buttons) are shown separately by "
            "the app - so keep your own text brief and natural (e.g. \"Here "
            "are a few laptops that fit\"), and NEVER mention product IDs, "
            "database IDs, or any internal identifiers in your reply."
        )

    history_in = [m.model_dump() for m in request.history]

    result = run_with_tools(
        system_prompt=system_prompt,
        user_message=request.message,
        tools=ALL_TOOLS,
        token=request.token,
        authenticated=authenticated,
        history=history_in,
    )

    # We deliberately store only plain user/assistant text turns here (not
    # the raw tool_use/tool_result blocks the LLM saw) - that's enough for
    # the model to stay grounded on what was already said/decided, and it
    # keeps the history format identical across both LLM providers.
    updated_history = request.history + [
        ChatMessage(role="user", content=request.message),
        ChatMessage(role="assistant", content=result["reply"]),
    ]

    return ChatResponse(
        reply=result["reply"],
        authenticated=authenticated,
        user_name=user["name"] if user else None,
        action=result.get("action"),
        tools_used=[tc["name"] for tc in result.get("tool_calls", [])],
        products=_extract_products(result.get("tool_calls", [])),
        cart=_extract_cart(result.get("tool_calls", [])),
        history=updated_history,
    )
