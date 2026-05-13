# ADR 1: Selection of Architecture Styles

**Date:** 2026-05-12
**Status:** Accepted

## Context
The Task Manager AI requires a structured approach to handle task lifecycles, real-time Telegram interactions, and AI-driven insights.

## Decision
We adopted a **Hybrid Architecture** based on the following styles:

1.  **Layered Architecture (N-Tier):** The application follows a strict separation of concerns:
    * **Presentation:** REST Controllers.
    * **Business Logic:** Services like `KpiService` and `GeminiService`.
    * **Data Access:** Spring Data JPA Repositories.
2.  **Event-Driven (Broker Topology):** Used for the Telegram Bot. Incoming Webhooks act as events processed by `MyTodoListBot`, which maintains state and dispatches actions to other services.
3.  **Pipeline Architecture:** The "Insight Generation" process works as a pipeline where data is fetched via `SprintRepository`, metrics are calculated in `KpiService`, and final enrichment is performed by `GeminiService`.

## Consequences
* **Pros:** High modularity. The AI logic is decoupled from the KPI calculation logic.
* **Cons:** Managing asynchronous state in the bot increases the complexity of the "Observer" pattern implemented in the Telegram SDK.