# ADR 2: Database and ORM Strategy

**Date:** 2026-05-12
**Status:** Accepted

## Context
The system manages complex relationships (e.g., Many-to-Many for User-Tasks and Team-Members) that require high data integrity in Oracle ADB.

## Decision
We utilize **Spring Data JPA** with a Relational Schema:
* **Composite Primary Keys:** We use `@EmbeddedId` (e.g., `UserTaskId`) to manage intersection tables, ensuring that relationships are unique and indexed correctly.
* **Transactional Integrity:** We use `@Transactional` in `KpiService` to ensure that KPI calculations and database updates occur atomically, preventing partial data writes.
* **Precision Handling:** We use `BigDecimal` for all KPI metrics (Completion Rate, Punctuality) to avoid floating-point rounding errors during aggregate calculations.

## Consequences
* **Pros:** Strong consistency and robust handling of relational constraints.
* **Cons:** Potential performance overhead of JPA during heavy batch updates, mitigated by OCI's Autonomous Database indexing.