"""
The RAG tool. Per the spec: RAG is for knowledge that doesn't change
per-user or require live data (policies, FAQs) - never for orders,
cart, or anything transactional. Those always go through the real
API tools instead, never through retrieved documents.
"""

from app.rag.retriever import retrieve

TOOLS = [
    {
        "name": "search_store_knowledge",
        "description": (
            "Search CircuitCart's shipping, return, refund, warranty, and payment "
            "policies, plus general FAQs. Use this for general policy questions like "
            "'how long does shipping take' or 'what's your return policy'. Do NOT use "
            "this for questions about a specific order, cart, or account - use the "
            "order/cart tools for those instead, since this only has general policy "
            "text, not live data. IMPORTANT: when you answer using this tool's "
            "results, use ONLY the exact facts in the returned text. Do not add "
            "details, exceptions, processes, or examples that aren't explicitly "
            "stated in the results, even if they sound like typical store policy - "
            "if the results don't mention something, don't mention it either."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "The policy or FAQ question to search for",
                },
            },
            "required": ["query"],
        },
        "requires_auth": False,
        "executor": lambda token, **kwargs: _search_knowledge(**kwargs),
    },
]


def _search_knowledge(query: str) -> dict:
    try:
        results = retrieve(query, top_k=4)
        if not results:
            return {"success": True, "data": {"found": False}}
        return {
            "success": True,
            "data": {
                "found": True,
                "instruction": (
                    "Answer using ONLY the facts in these results. Do not add "
                    "anything not explicitly stated here."
                ),
                "results": [{"text": r["text"], "source": r["metadata"]["source"]} for r in results],
            },
        }
    except FileNotFoundError as e:
        return {"success": False, "error": str(e)}
