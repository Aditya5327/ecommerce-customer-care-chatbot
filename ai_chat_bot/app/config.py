import os
from dotenv import load_dotenv

load_dotenv()

# Everything else in the app reads config from here - nothing else should
# call os.getenv() directly. This is what makes swapping LLM providers
# later just an env var change instead of a code change.

LLM_PROVIDER = os.getenv("LLM_PROVIDER", "groq").lower()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-5")

CHATBOT_PORT = int(os.getenv("CHATBOT_PORT", "8000"))

# Your existing Node/Express backend - the chatbot calls this exactly like
# a logged-in browser would, using the same JWT the website already issues.
NODE_BACKEND_URL = os.getenv("NODE_BACKEND_URL", "http://localhost:5000/api")

# Only require the API key for whichever provider is actually selected -
# no reason to force someone using Groq to also have an Anthropic key.
if LLM_PROVIDER == "groq" and not GROQ_API_KEY:
    raise ValueError(
        "LLM_PROVIDER is 'groq' but GROQ_API_KEY is not set. "
        "Copy .env.example to .env and add your free key from console.groq.com/keys"
    )
if LLM_PROVIDER == "anthropic" and not ANTHROPIC_API_KEY:
    raise ValueError(
        "LLM_PROVIDER is 'anthropic' but ANTHROPIC_API_KEY is not set. "
        "Add your key from console.anthropic.com/settings/keys"
    )
if LLM_PROVIDER not in ("groq", "anthropic"):
    raise ValueError(f"Unknown LLM_PROVIDER '{LLM_PROVIDER}' - use 'groq' or 'anthropic'")
