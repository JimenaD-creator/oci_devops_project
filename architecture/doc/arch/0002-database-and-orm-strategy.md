# ADR-0002: Database and ORM Strategy

**Date:** 2026-05-12
**Status:** Accepted

## Context
The system manages complex relationships (e.g., Many-to-Many for User-Tasks and Team-Members) that require high data integrity in Oracle ADB.

## Decision
We utilize **Spring Data JPA** with a Relational Schema:
* **Composite Primary Keys:** We use `@EmbeddedId` (e.g., `UserTaskId`) to manage intersection tables, ensuring that relationships are unique and indexed correctly.
* **Transactional Integrity:** We use `@Transactional` in `KpiService` to ensure that KPI calculations and database updates occur atomically, preventing partial data writes.
* **Precision Handling:** We use `BigDecimal` for all KPI metrics (Completion Rate, Punctuality) to avoid floating-point rounding errors during aggregate calculations.

## Alternatives considered

* **Plain JDBC or jOOQ without JPA entities:** Would reduce ORM overhead for heavy reporting paths but would duplicate mapping logic and slow feature delivery for CRUD-heavy domain areas; JPA fits the existing Spring stack and team familiarity.
* **Surrogate single-column keys for all link tables:** Would simplify some repository APIs but weakens the natural uniqueness of `(user_id, task_id)`-style relationships unless extra unique constraints are added; composite `@EmbeddedId` matches the relational model directly.
* **`double` / `float` for KPI aggregates:** Rejected due to rounding and display inconsistencies when persisting scores that are shown in dashboards and fed into LLM prompts.
* **Read models in a separate document store:** Deferred; Oracle ADB plus indexed relational queries and stored aggregates meet current scale.

## Consequences
* **Pros:** Strong consistency and robust handling of relational constraints.
* **Cons:** Potential performance overhead of JPA during heavy batch updates, mitigated by OCI's Autonomous Database indexing.