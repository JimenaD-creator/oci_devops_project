# ADR-0005: Retrieval-Augmented Generation (RAG) for Semantic Context

**Date:** 2026-05-12
**Status:** Accepted

## Context
The "Manager Chat" feature needs to answer questions about hundreds of tasks. Sending all task data to the LLM is impossible due to token limits and costs.

## Decision
We implemented a **RAG (Retrieval-Augmented Generation)** pattern:
* **Vectorization:** Using `EmbeddingService` with the `gemini-embedding-001` model to transform a compact task text chunk (title, status, priority, type, due date from `buildTaskChunk`) into embedding vectors; dimensionality follows the API response and is stored as a JSON array of doubles per task.
* **Semantic Retrieval:** Instead of keyword search, we implemented a custom similarity engine using **Cosine Similarity** to find the "Top-K" most relevant tasks for any manager query.
* **Augmented Prompting:** The `ManagerChatService` acts as an orchestrator that:
    1. Generates an embedding for the user query.
    2. Retrieves contextually similar tasks from the `TaskEmbeddingRepository`.
    3. Constructs a context-aware prompt and calls **`gemini-3.1-flash-lite-preview`** via the Generative Language `generateContent` endpoint (model id may evolve in config; this is the current production string in `ManagerChatService`).

## Alternatives considered

* **Dump all sprint tasks into the prompt (no retrieval):** Rejected: exceeds context limits, increases cost, and produces shallow answers when the model attends to noise.
* **Keyword / SQL-only filtering (no embeddings):** Cheaper and simpler but brittle for paraphrased manager questions and cross-field semantics; embeddings plus cosine similarity match how users actually ask questions.
* **Managed vector database (e.g. Pinecone, `pgvector`) with ANN indexes:** Strong at very large corpora; not required yet—storing vectors as JSON on `TaskEmbedding` and scanning per sprint keeps the stack on Oracle and reduces operational surface.
* **Different embedding models (e.g. other Gemini or third-party APIs):** Possible future swap; `gemini-embedding-001` was chosen for consistency with the same vendor and API surface already used for chat.

## Consequences
* **Pros:** Highly accurate responses based on real project data. Efficient use of API tokens.
* **Cons:** Requires consistent re-indexing (via `buildTaskChunk`) whenever task metadata is significantly updated.