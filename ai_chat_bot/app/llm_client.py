"""
Thin abstraction so the rest of the app never needs to know which LLM
provider is active. Today this just does plain chat completion (no
tools yet) - when we add tool-calling in a later step, this file grows,
but callers still just call get_completion(...).
"""

from app.config import (
    LLM_PROVIDER,
    GROQ_API_KEY,
    GROQ_MODEL,
    ANTHROPIC_API_KEY,
    ANTHROPIC_MODEL,
)


def get_completion(system_prompt: str, user_message: str) -> str:
    if LLM_PROVIDER == "groq":
        return _groq_completion(system_prompt, user_message)
    elif LLM_PROVIDER == "anthropic":
        return _anthropic_completion(system_prompt, user_message)
    else:
        raise ValueError(f"Unsupported LLM_PROVIDER: {LLM_PROVIDER}")


def _groq_completion(system_prompt: str, user_message: str) -> str:
    from groq import Groq

    client = Groq(api_key=GROQ_API_KEY)
    response = client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ],
        max_tokens=500,
    )
    return response.choices[0].message.content


def _anthropic_completion(system_prompt: str, user_message: str) -> str:
    from anthropic import Anthropic

    client = Anthropic(api_key=ANTHROPIC_API_KEY)
    response = client.messages.create(
        model=ANTHROPIC_MODEL,
        max_tokens=500,
        system=system_prompt,
        messages=[{"role": "user", "content": user_message}],
    )
    return response.content[0].text


def run_with_tools(system_prompt: str, user_message: str, tools: list[dict],
                    token: str | None, authenticated: bool,
                    history: list[dict] | None = None) -> dict:
    """
    The actual agent loop: the LLM is offered a list of tools, decides
    whether to use one, we run the REAL Python function for it (which
    hits your real Node backend), and feed the real result back so the
    LLM's final reply is grounded in real data - never invented.

    Auth is enforced HERE, before any tool runs - not left to the LLM.
    If a tool needs login and the user isn't authenticated, we return a
    structured "log in first" result instead of ever calling the tool.

    `history` is prior plain user/assistant turns for THIS conversation
    (oldest first) - see ChatRequest.history in main.py. Passing [] (or
    None) means "no memory of earlier turns", which is correct for the
    very first message but wrong for any follow-up.

    Returns: {"reply": str, "tool_calls": [{"name": str, "result": dict}]}
    """
    history = history or []
    if LLM_PROVIDER == "groq":
        return _groq_run_with_tools(system_prompt, user_message, tools, token, authenticated, history)
    elif LLM_PROVIDER == "anthropic":
        return _anthropic_run_with_tools(system_prompt, user_message, tools, token, authenticated, history)
    else:
        raise ValueError(f"Unsupported LLM_PROVIDER: {LLM_PROVIDER}")


def _execute_tool(tool_def: dict, args: dict, token: str | None, authenticated: bool) -> dict:
    if tool_def["requires_auth"] and not authenticated:
        return {
            "success": False,
            "error": "AUTHENTICATION_REQUIRED",
            "message": "Please log in to continue.",
        }
    try:
        return tool_def["executor"](token, **args)
    except Exception as e:
        return {"success": False, "error": f"Tool failed: {e}"}


def _extract_action(tool_call_log: list[dict]) -> dict | None:
    """
    Some tools (like initiate_checkout) return a structured "action" the
    frontend needs to act on - e.g. opening the real Razorpay widget.
    Surface the most recent one, if any, at the top level of the response.

    Also detects when any tool was blocked because the user wasn't
    logged in, and surfaces that as an OPEN_LOGIN action - so the
    frontend can show a real "Log in" button instead of the person
    having to notice it from the text alone.
    """
    for entry in reversed(tool_call_log):
        action = entry["result"].get("action")
        if action:
            return action

    for entry in tool_call_log:
        if entry["result"].get("error") == "AUTHENTICATION_REQUIRED":
            return {"type": "OPEN_LOGIN"}

    return None


def _groq_run_with_tools(system_prompt, user_message, tools, token, authenticated, history=None) -> dict:
    import json
    from groq import Groq

    client = Groq(api_key=GROQ_API_KEY)
    tools_by_name = {t["name"]: t for t in tools}
    groq_tools = [
        {
            "type": "function",
            "function": {
                "name": t["name"],
                "description": t["description"],
                "parameters": t["parameters"],
            },
        }
        for t in tools
    ]

    messages = (
        [{"role": "system", "content": system_prompt}]
        + list(history or [])
        + [{"role": "user", "content": user_message}]
    )
    tool_call_log = []

    # Loop a few rounds in case the model wants to call more than one
    # tool in sequence (e.g. search, then get details on one result).
    for round_num in range(5):
        response = client.chat.completions.create(
            model=GROQ_MODEL, messages=messages, tools=groq_tools, max_tokens=800
        )
        msg = response.choices[0].message

        if not msg.tool_calls:
            print(f"[round {round_num}] final reply: {msg.content}")
            return {"reply": msg.content, "tool_calls": tool_call_log, "action": _extract_action(tool_call_log)}

        print(f"[round {round_num}] model wants to call: {[tc.function.name for tc in msg.tool_calls]}")

        messages.append(
            {
                "role": "assistant",
                "content": msg.content or "",
                "tool_calls": [
                    {
                        "id": tc.id,
                        "type": "function",
                        "function": {"name": tc.function.name, "arguments": tc.function.arguments},
                    }
                    for tc in msg.tool_calls
                ],
            }
        )

        for tc in msg.tool_calls:
            args = json.loads(tc.function.arguments or "{}")
            tool_def = tools_by_name.get(tc.function.name)
            result = (
                _execute_tool(tool_def, args, token, authenticated)
                if tool_def
                else {"success": False, "error": "Unknown tool"}
            )
            tool_call_log.append({"name": tc.function.name, "result": result})
            print(f"[round {round_num}] {tc.function.name}({args}) -> {result}")
            messages.append(
                {
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "name": tc.function.name,
                    "content": json.dumps(result),
                }
            )

    return {
        "reply": "I ran into trouble finishing that request. Could you try rephrasing?",
        "tool_calls": tool_call_log,
        "action": _extract_action(tool_call_log),
    }


def _anthropic_run_with_tools(system_prompt, user_message, tools, token, authenticated, history=None) -> dict:
    import json
    from anthropic import Anthropic

    client = Anthropic(api_key=ANTHROPIC_API_KEY)
    tools_by_name = {t["name"]: t for t in tools}
    anthropic_tools = [
        {"name": t["name"], "description": t["description"], "input_schema": t["parameters"]}
        for t in tools
    ]

    messages = list(history or []) + [{"role": "user", "content": user_message}]
    tool_call_log = []

    for _ in range(5):
        response = client.messages.create(
            model=ANTHROPIC_MODEL,
            max_tokens=800,
            system=system_prompt,
            messages=messages,
            tools=anthropic_tools,
        )

        if response.stop_reason != "tool_use":
            text_blocks = [b.text for b in response.content if b.type == "text"]
            return {
                "reply": "".join(text_blocks),
                "tool_calls": tool_call_log,
                "action": _extract_action(tool_call_log),
            }

        messages.append({"role": "assistant", "content": response.content})

        tool_results = []
        for block in response.content:
            if block.type != "tool_use":
                continue
            tool_def = tools_by_name.get(block.name)
            result = (
                _execute_tool(tool_def, block.input, token, authenticated)
                if tool_def
                else {"success": False, "error": "Unknown tool"}
            )
            tool_call_log.append({"name": block.name, "result": result})
            tool_results.append(
                {"type": "tool_result", "tool_use_id": block.id, "content": json.dumps(result)}
            )

        messages.append({"role": "user", "content": tool_results})

    return {
        "reply": "I ran into trouble finishing that request. Could you try rephrasing?",
        "tool_calls": tool_call_log,
        "action": _extract_action(tool_call_log),
    }
