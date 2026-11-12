"""
Loads the FAISS index built by ingest.py and answers similarity queries.
The model and index are loaded once at import time (not per-request) -
loading a model takes real time, so we don't want to redo it on every
chat message.
"""

import os
import json
import faiss
from sentence_transformers import SentenceTransformer

from app.rag.ingest import EMBEDDING_MODEL, INDEX_PATH, CHUNKS_PATH

_model = None
_index = None
_chunks = None


def _ensure_loaded():
    global _model, _index, _chunks

    if _model is None:
        if not os.path.exists(INDEX_PATH):
            raise FileNotFoundError(
                "RAG index not found. Run this first:\n"
                "  python -m app.rag.ingest"
            )
        _model = SentenceTransformer(EMBEDDING_MODEL)
        _index = faiss.read_index(INDEX_PATH)
        with open(CHUNKS_PATH, "r", encoding="utf-8") as f:
            _chunks = json.load(f)


def retrieve(query: str, top_k: int = 3) -> list[dict]:
    """
    Returns the top_k most relevant chunks for a query, each as
    {"text": ..., "metadata": {...}, "score": float}. Lower score =
    more similar (FAISS L2 distance - smaller means closer).
    """
    _ensure_loaded()

    query_embedding = _model.encode([query], convert_to_numpy=True)
    distances, indices = _index.search(query_embedding, top_k)

    results = []
    for dist, idx in zip(distances[0], indices[0]):
        if idx == -1:
            continue
        chunk = _chunks[idx]
        results.append({
            "text": chunk["text"],
            "metadata": chunk["metadata"],
            "score": float(dist),
        })
    return results
