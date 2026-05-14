# ADR-0003: Asynchronous AI Insight Generation

**Date:** 2026-05-12
**Status:** Accepted

## Context
Calling the Gemini API is a high-latency operation (network I/O). Holding the **HTTP request thread** until Gemini returns would result in a poor user experience and risks timeouts under load.

## Decision
We implemented an **asynchronous background execution** pattern for sprint insight generation:
* **Offload from the request thread:** `GeminiService.generateInsightsForSprint` is marked with `@Async`, so `InsightsController` can return **202 Accepted** immediately while generation and persistence run on a **background executor thread** (the client polls `GET /api/insights/sprint/{id}` until a result or error row exists). This is **not** reactive non-blocking I/O: inside the worker, calls to Gemini still use **blocking** `HttpClient.send(...)`.
* **Native HTTP client:** `GeminiService` (and `EmbeddingService` for embeddings) uses Java 11+ `HttpClient` for calls to the Google Generative Language API.
* **Separation of Concerns:** The prompt construction logic (prompt templates) is encapsulated within the service, keeping the controllers clean of "prompt engineering" details.

## Alternatives considered

* **Synchronous generation inside the controller (blocking until Gemini returns):** Rejected: ties up servlet threads, risks gateway timeouts, and degrades UX for long prompts.
* **Dedicated worker process or external queue (e.g. Redis, OCI Queue):** Strong option at higher scale; not adopted yet to avoid extra moving parts and infrastructure for the current workload.
* **Server-Sent Events or WebSockets pushing completion:** Could replace HTTP polling; adds frontend and connection-management complexity beyond the current requirement.
* **Spring WebFlux end-to-end:** Rejected as a broad rewrite; `@Async` offloads long-running work from servlet threads without adopting full reactive stacks.

## Consequences
* **Pros:** Improved application responsiveness and throughput.
* **Cons:** Requires additional observability (logging) to track the completion of background AI tasks.