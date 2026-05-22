# Backend testing

## Scope

Backend **unit tests** use Mockito and `@WebMvcTest` (no Oracle, Telegram, or live Gemini in CI).

**Path B coverage gate (`-Pcoverage-check`):** ≥ 70% line coverage on **20 scoped classes** (see `pom.xml` profile `coverage-check`): 8 controllers, 9 services (including `UserTaskService`), and `BotUserState` + `BotStateManager`. Excludes AI HTTP (`GeminiService`, etc.), `BotActions` (orchestrator — tested but not gated), bot controller, and boilerplate.

**Excluded from the gate** (may still be tested optionally):

- `GeminiService` (logic-only tests in `GeminiServiceTest`; omitted from gate — large class, slows JaCoCo), `DeepSeekService`, `ManagerChatService`, `EmbeddingService`
- `BotActions`, `ToDoItemBotController`, AI-related controllers (`BotStateManager` is in the gate; `BotActions` is not)
- `model`, `dto`, `repository`, `config`, `security`

## Run tests

```bash
cd MtdrSpring/backend
mvn test -Dspring.profiles.active=test
```

Reports: `target/surefire-reports/`

## Verify ~70% coverage (JaCoCo)

Every `mvn test` generates an HTML report (does **not** fail the build):

```bash
mvn clean test -Dspring.profiles.active=test
```

Open in a browser:

`MtdrSpring/backend/target/site/jacoco/index.html`

Use the **Total** row (line coverage) for packages you care about (`controller`, `service`, `util`, `security`). Ignore excluded AI HTTP services and `model` / `dto` / `repository` / `config` when judging the 70% goal (see Scope above).

**Path B gate** — fails if scoped line coverage is below 70% (AI + `BotActions` excluded):

```powershell
mvn clean verify "-Pcoverage-check" "-Dspring.profiles.active=test"
```

On PowerShell, always quote `-D` and `-P` arguments.

**IDE (no Maven):** In IntelliJ or VS Code with Java Test Runner, right-click `src/test/java` → **Run with Coverage**, then read the Coverage tool window.

**Screenshot for deliverables:** capture the JaCoCo HTML summary or IDE coverage % for `controller` + `service` + `util` packages.

## OCI pipeline

Add a build step:

```bash
cd MtdrSpring/backend && mvn -B test -Dspring.profiles.active=test
```

## Layout

```text
src/test/java/com/springboot/MyTodoList/
  util/BotActionsTest.java
  util/BotStateManagerTest.java
  util/BotUserStateTest.java
  service/JwtServiceTest.java
  service/GeminiServiceTest.java
  service/TaskServiceTest.java
  service/SprintServiceTest.java
  service/UserServiceTest.java
  controller/AuthControllerTest.java
  controller/TaskControllerTest.java
  controller/SprintControllerTest.java
  controller/UserControllerTest.java
  controller/KpiControllerTest.java
  controller/ProjectControllerTest.java
  controller/UserTaskControllerTest.java
  controller/ToDoItemControllerTest.java
  service/KpiServiceTest.java
  service/ToDoItemServiceTest.java
  service/TaskAssignmentSyncServiceTest.java
  service/AdminServiceTest.java
  service/UserTaskServiceTest.java   (sprint index, status, hours, blocked, reopen)
```

**145+ tests** (run `mvn test` to see current count).

Tier-1 controller coverage: `TaskControllerTest` (multi-assignee PUT), `SprintControllerTest` (PUT), `ProjectControllerTest` (all GET variants).

Tier-2: `KpiControllerTest` (workload-balance, team-participation, 404 paths), `AdminServiceTest` (`createTeam` + error paths), `util/BotUserStateTest`.

Run only `UserTaskService` tests:

```powershell
mvn test "-Dspring.profiles.active=test" "-Dtest=UserTaskServiceTest"
```

### GeminiService (logic only, no live API)

```powershell
mvn test "-Dspring.profiles.active=test" "-Dtest=GeminiServiceTest"
```

Fixtures: `src/test/resources/gemini/`. Tests cover:

- Early exit when fewer than two sprint snapshots
- **Fallback** variation math (empty API key → no HTTP)
- `enrichInsightsForResponse` (snake_case → camelCase, DB-filled `developerInsights`, task status breakdown)
- `extractJsonFromGeminiResponse` (markdown fence stripping via reflection)

`GeminiService` is excluded from the `-Pcoverage-check` gate (large class; slows CI). `GeminiServiceTest` still runs on every `mvn test`.

### Per-assignee on-time (`USER_TASK.COMPLETED_AT`)

On-time KPIs use each assignee’s completion time, not the task’s final `finishDate`. On an existing Oracle schema, run once:

```sql
ALTER TABLE USER_TASK ADD COMPLETED_AT TIMESTAMP(6);
```

New completions set `COMPLETED_AT` automatically when status moves to `COMPLETED`/`DONE`. Legacy rows without a timestamp are excluded from on-time/late counts for multi-assignee tasks (not counted as late).

`GET /api/insights/sprint/{id}` rewrites `developerInsights[].insight` from the **current** `USER_TASK` snapshot (per-assignee completion and `COMPLETED_AT`), so Team → “AI per-developer analysis” stays aligned with live data without regenerating Gemini. Regenerate in AI Insights only when you want a fresh full narrative (alerts, recommendations, executive summary).

When all assignees finish, `TASK.FINISH_DATE` is set to the **latest** `USER_TASK.COMPLETED_AT`, not the wall-clock moment of sync (fixes false “task late” if the last status change happens after the due date but assignees completed earlier).

To fix an existing closed task in SQL:

```sql
UPDATE TASK t
SET FINISH_DATE = (
  SELECT MAX(ut.COMPLETED_AT)
  FROM USER_TASK ut
  WHERE ut.TASK_ID = t.ID
)
WHERE t.ID = :task_id
  AND t.STATUS = 'DONE';
```
