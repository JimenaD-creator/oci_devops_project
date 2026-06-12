# ADR-0005: Retrieval-Augmented Generation (RAG) for Semantic Context

**Date:** 2026-05-12
**Status:** Accepted

## Context
The "Manager Chat" feature needs to answer questions about hundreds of tasks. Sending all task data to the LLM is impossible due to token limits and costs.

## Decision
We implemented a **RAG (Retrieval-Augmented Generation)** pattern:
* **Vectorization:** Using `EmbeddingService` with the `gemini-embedding-001` model to transform a compact task text chunk (title, status, priority, type, due date from `buildTaskChunk`) into embedding vectors; dimensionality follows the API response and is stored as a JSON array of doubles per task.
* **Semantic Retrieval:** Implemented in **`TaskEmbeddingVectorStore`** (used by **`EmbeddingService`**): embeds the manager question, then either (a) on **Oracle 23ai+** runs **`VECTOR_DISTANCE(..., COSINE)`** against **`EMBEDDING_VEC VECTOR(768, FLOAT64)`** with an **IVF vector index**, optionally joining **`TASK`** for hybrid filters (`sprint_id`, `status`), or (b) in **application fallback** (H2 tests, pre-migration DB) loads JSON vectors from **`EMBEDDING` CLOB** and ranks with in-app cosine similarity. `ManagerChatService` does not query repositories directly.
* **Augmented Prompting:** **`ManagerChatService`** orchestrates the HTTP-facing flow: it calls **`EmbeddingService.findRelevantTasks(...)`** for the RAG slice, merges it with structured project/sprint context it builds from other repositories, then calls the Generative Language **`generateContent`** endpoint using **`gemini-3.1-flash-lite-preview`** (model id may evolve in config; this is the current production string in `ManagerChatService`).

## Alternatives considered

* **Dump all sprint tasks into the prompt (no retrieval):** Rejected: exceeds context limits, increases cost, and produces shallow answers when the model attends to noise.
* **Keyword / SQL-only filtering (no embeddings):** Cheaper and simpler but brittle for paraphrased manager questions and cross-field semantics; embeddings plus cosine similarity match how users actually ask questions.
* **Managed vector database (e.g. Pinecone, `pgvector`) with ANN indexes:** Strong at very large corpora; rejected in favor of **Oracle AI Vector Search** on Autonomous DB (`EMBEDDING_VEC` + IVF index). Migration SQL lives under `MtdrSpring/backend/src/main/resources/sql/oracle/`.
* **Application-only JSON scan (legacy):** Retained as `vector.search.mode=application` for local H2 tests and rollback; production uses `auto` to prefer native `VECTOR_DISTANCE` when `EMBEDDING_VEC` exists.
* **Different embedding models (e.g. other Gemini or third-party APIs):** Possible future swap; `gemini-embedding-001` was chosen for consistency with the same vendor and API surface already used for chat.

## Consequences
* **Pros:** Highly accurate responses based on real project data. Efficient use of API tokens.
* **Cons:** Requires consistent re-indexing (via `buildTaskChunk`) whenever task metadata is significantly updated.