# Oracle AI Vector Search — migration runbook

**Requires Oracle Database 23ai+** (Autonomous DB upgraded from 19c). On 19c, `VECTOR` DDL fails with ORA-00907.

## Steps (production)

1. Run `00_check_vector_support.sql` — probe must succeed.
2. Run `01_task_embeddings_vector_migration.sql` — adds `EMBEDDING_VEC` + IVF index.
3. Set `VECTOR_SEARCH_MODE=auto` (default) or `oracle` in `.env` / OKE secrets.
4. Rebuild and restart the backend (Docker or OKE).
5. Re-index each sprint: `POST /api/embeddings/sprint/{sprintId}/index`
6. Verify: `GET /api/embeddings/sprint/{id}` → `"vectorSearchBackend": "ORACLE"`

## Rollback

Set `VECTOR_SEARCH_MODE=application` — app uses JSON `EMBEDDING` CLOB + in-app cosine. No DB downgrade needed.
