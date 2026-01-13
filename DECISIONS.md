# Decision Log (ADR-lite)

This file captures key engineering and product decisions for the MVP.
Goal: keep decisions searchable, explicit, and resistant to “tribal memory”.

Rules:
- Write decisions in plain language.
- Prefer small, frequent entries over big, rare ones.
- Include alternatives considered and why we rejected them.
- If a decision changes, add a new entry that supersedes the old one (do not rewrite history).

---

## D-000 — Template / How to use this file
**Date:** YYYY-MM-DD  
**Status:** Accepted | Superseded | Deprecated  
**Decision:** <one sentence>  
**Context:** What problem are we solving? Why now?  
**Options considered:**
1) Option A — pros/cons  
2) Option B — pros/cons  
**Chosen option:** Option A  
**Rationale:** Why this option is best now (tradeoffs acknowledged).  
**Consequences:** What this enables, what it makes harder, risks introduced.  
**Follow-ups:** Any tasks to execute/verify the decision.  
**Owner:** <name/role>  
**Links:** PRs, docs, issues

---

## D-001 — Environment isolation: separate Supabase projects for staging and prod
**Date:** YYYY-MM-DD  
**Status:** Accepted  
**Decision:** Staging and Production use separate Supabase projects (DB/Auth/Storage).  
**Context:** Prevent cross-environment data leaks and accidental writes.  
**Options considered:**
1) Single Supabase project with separate schemas/buckets  
2) Separate Supabase projects (preferred)  
**Chosen option:** Separate Supabase projects  
**Rationale:** Strongest isolation with simplest mental model; avoids dangerous misconfig.  
**Consequences:** Slightly higher admin overhead; need secret management per env.  
**Follow-ups:** Ensure CI/CD uses distinct env vars and secrets; add smoke checks.  
**Owner:**  
**Links:**  

---

## D-002 — Heavy processing must not run in web request lifecycle
**Date:** YYYY-MM-DD  
**Status:** Accepted  
**Decision:** All ffmpeg/transcription/LLM analysis runs in background workers via a queue.  
**Context:** File processing is slow, failure-prone, and can kill web responsiveness.  
**Options considered:**
1) Run processing in API handlers  
2) Background worker + queue (preferred)  
**Chosen option:** Worker + queue  
**Rationale:** Reliability, retries, concurrency control, better UX (status/progress).  
**Consequences:** Need queue infra; need job model and observability.  
**Follow-ups:** Add processing_jobs table; implement idempotency keys.  
**Owner:**  
**Links:**  

---

## D-003 — RLS-first security model
**Date:** YYYY-MM-DD  
**Status:** Accepted  
**Decision:** All customer data is protected by Supabase RLS scoped by org_id from day one.  
**Context:** Commercially sensitive data requires strong isolation and least-privilege access.  
**Options considered:**
1) App-level filtering only  
2) RLS + org-scoped schema (preferred)  
**Chosen option:** RLS + org-scoping  
**Rationale:** Prevents entire classes of bugs/leaks; scales with role expansion later.  
**Consequences:** More careful schema and policies; tests must validate RLS behavior.  
**Follow-ups:** Add RLS tests; document access rules.  
**Owner:**  
**Links:**  

---

## D-004 — External API calls are mocked in unit tests
**Date:** YYYY-MM-DD  
**Status:** Accepted  
**Decision:** Unit tests must not call SpeechKit/OpenAI; use adapters and mocks.  
**Context:** Real calls cause flakiness, cost, and rate-limit problems in CI.  
**Options considered:**
1) Real calls in CI  
2) Adapter layer with mocks + optional manual smoke scripts (preferred)  
**Chosen option:** Adapter + mocks  
**Rationale:** Stable CI, fast feedback, deterministic tests.  
**Consequences:** Must maintain good contract tests and smoke checks.  
**Follow-ups:** Create `scripts/smoke_*` for manual verification.  
**Owner:**  
**Links:**  
