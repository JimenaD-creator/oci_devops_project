# ADR 3: Asynchronous AI Insight Generation

**Date:** 2026-05-12
**Status:** Accepted

## Context
Calling the Gemini API is a high-latency operation (network I/O). Blocking the main execution thread would result in a poor user experience.

## Decision
We implemented an **Asynchronous Execution Pattern**:
* **Non-blocking calls:** The `GeminiService.generateSprintInsights` method is marked with `@Async`, allowing the REST controller to return a confirmation immediately while the AI processes data in the background.
* **Native HTTP Client:** We use Java 11 `HttpClient` for optimized, asynchronous request-response handling with the Google Gemini endpoint.
* **Separation of Concerns:** The prompt construction logic (prompt templates) is encapsulated within the service, keeping the controllers clean of "prompt engineering" details.

## Consequences
* **Pros:** Improved application responsiveness and throughput.
* **Cons:** Requires additional observability (logging) to track the completion of background AI tasks.