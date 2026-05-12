# ADR 5: Retrieval-Augmented Generation (RAG) for Semantic Context

**Date:** 2026-05-12
**Status:** Accepted

## Context
The "Manager Chat" feature needs to answer questions about hundreds of tasks. Sending all task data to the LLM is impossible due to token limits and costs.

## Decision
We implemented a **RAG (Retrieval-Augmented Generation)** pattern:
* **Vectorization:** Using `EmbeddingService` with the `gemini-embedding-001` model to transform task attributes (Title, Status, Priority) into 768-dimensional vectors.
* **Semantic Retrieval:** Instead of keyword search, we implemented a custom similarity engine using **Cosine Similarity** to find the "Top-K" most relevant tasks for any manager query.
* **Augmented Prompting:** The `ManagerChatService` acts as an orchestrator that:
    1. Generates an embedding for the user query.
    2. Retrieves contextually similar tasks from the `TaskEmbeddingRepository`.
    3. Construct a "Context-Aware" prompt for `gemini-1.5-flash`.

## Consequences
* **Pros:** Highly accurate responses based on real project data. Efficient use of API tokens.
* **Cons:** Requires consistent re-indexing (via `buildTaskChunk`) whenever task metadata is significantly updated.