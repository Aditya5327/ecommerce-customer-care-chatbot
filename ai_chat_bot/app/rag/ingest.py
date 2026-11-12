"""
Builds the FAISS vector index from the policy documents in ./documents/.
Run this once (and again any time you edit/add a document):

    python -m app.rag.ingest

Chunking strategy: each document is small enough (a few paragraphs) that
we chunk by paragraph (blank-line separated) rather than a fixed token
window - this keeps each chunk as one complete, coherent idea, which
retrieves better for short policy documents than an arbitrary character
split would.
"""

import os
import json
import faiss
from sentence_transformers import SentenceTransformer

DOCS_DIR = os.path.join(os.path.dirname(__file__), "documents")
VECTORSTORE_DIR = os.path.join(os.path.dirname(__file__), "vectorstore")
INDEX_PATH = os.path.join(VECTORSTORE_DIR, "faiss.index")
CHUNKS_PATH = os.path.join(VECTORSTORE_DIR, "chunks.json")

EMBEDDING_MODEL = "all-MiniLM-L6-v2"  # small, fast, free, runs locally - no API needed


def load_and_chunk_documents() -> list[dict]:
    """
    Returns a list of {"text": ..., "metadata": {"source": filename}}.
    """
    chunks = []
    for filename in sorted(os.listdir(DOCS_DIR)):
        if not filename.endswith(".txt"):
            continue

        source = filename.replace(".txt", "")
        path = os.path.join(DOCS_DIR, filename)
        with open(path, "r", encoding="utf-8") as f:
            content = f.read()

        paragraphs = [p.strip() for p in content.split("\n\n") if p.strip()]

        # Merge very short paragraphs (like a lone title line, e.g.
        # "Return and Refund Policy") into the next paragraph instead of
        # making them their own chunk - a title alone carries almost no
        # retrievable meaning and just wastes a top-k slot.
        merged_paragraphs = []
        buffer = ""
        for p in paragraphs:
            if len(p.split()) < 6:
                buffer = f"{buffer} {p}".strip() if buffer else p
                continue
            merged_paragraphs.append(f"{buffer} {p}".strip() if buffer else p)
            buffer = ""
        if buffer:
            merged_paragraphs.append(buffer)

        for paragraph in merged_paragraphs:
            chunks.append({
                "text": paragraph,
                "metadata": {"source": source, "category": source},
            })

    return chunks


def build_index():
    print("Loading and chunking documents...")
    chunks = load_and_chunk_documents()
    print(f"Created {len(chunks)} chunks from {len(os.listdir(DOCS_DIR))} documents.")

    print(f"Loading embedding model ({EMBEDDING_MODEL})... this may download ~90MB the first time.")
    model = SentenceTransformer(EMBEDDING_MODEL)

    texts = [c["text"] for c in chunks]
    print("Computing embeddings...")
    embeddings = model.encode(texts, show_progress_bar=True, convert_to_numpy=True)

    dimension = embeddings.shape[1]
    index = faiss.IndexFlatL2(dimension)
    index.add(embeddings)

    os.makedirs(VECTORSTORE_DIR, exist_ok=True)
    faiss.write_index(index, INDEX_PATH)
    with open(CHUNKS_PATH, "w", encoding="utf-8") as f:
        json.dump(chunks, f, indent=2)

    print(f"Saved index ({index.ntotal} vectors, dim={dimension}) to {INDEX_PATH}")
    print(f"Saved chunk metadata to {CHUNKS_PATH}")


if __name__ == "__main__":
    build_index()
