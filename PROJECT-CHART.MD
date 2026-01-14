Я отвечу как world-class Principal Software Architect по B2B SaaS и распределённым системам, лауреат ACM SIGOPS Mark Weiser Award

Ниже — готовый Project Charter в формате Markdown. Его можно положить в репозиторий как PROJECT_CHARTER.md.

⸻

Project Charter — MVP B2B SaaS (Call/Presentation Analytics)

1. Purpose

Build a minimal but production-grade B2B SaaS that customers can pay for. The MVP must deliver a stable end-to-end processing pipeline for meeting recordings and provide actionable analytics for a Sales Head user.

The product must be operational on Yandex Cloud VPS and use:
	•	Supabase: DB, Object Storage, Auth
	•	Yandex SpeechKit v3 (gRPC, async): transcription
	•	OpenAI Agents SDK: LLM-based analysis

2. MVP Success Criteria

The MVP is considered successful when:
	•	A paying customer can log in and upload a recording (video/audio or transcript).
	•	The system processes the upload reliably and displays clear job statuses.
	•	The customer can view results (at least: summary + extracted insights with supporting quotes/timecodes if available).
	•	Failures are handled gracefully: visible error + retry without data corruption.
	•	Staging and Production are isolated and do not interfere with each other.

3. Scope

3.1 In Scope (MVP)

User-facing
	•	Login via Supabase Auth.
	•	Single customer role initially: “Head of Sales / Sales Manager” (admin-created accounts allowed).
	•	Screens (minimal versions):
	•	Login
	•	Settings (minimal org/user context)
	•	List of presentations/calls (uploads)
	•	Upload flow with status
	•	Presentation/call details with results

Processing pipeline
	•	Upload to Supabase Object Storage.
	•	Job orchestration for processing stages:
	•	(Optional) video → audio extraction (ffmpeg)
	•	transcription via SpeechKit (if audio/video)
	•	LLM analysis via OpenAI Agents SDK (from transcript)
	•	Persist artifacts and results in Supabase DB/Storage.
	•	Idempotent processing + retries.

Admin
	•	Minimal admin capability to create organizations and register/invite users.
	•	Admin actions must be protected and audited.

Reliability & Operability
	•	Queue-based background processing (no heavy work in web request lifecycle).
	•	Clear job status model: queued / processing / done / failed.
	•	Observability: structured logs with correlation IDs, persistent job errors.

DevOps
	•	CI pipeline: lint + tests.
	•	CD pipeline: deploy to staging automatically; deploy to prod via gated step (tag/release/manual).
	•	Staging/Prod isolation (separate Supabase projects and secrets).

3.2 Out of Scope (MVP)
	•	Multi-role model beyond the initial customer role (sales reps, teams, permissions matrix).
	•	Advanced analytics across departments or long-term aggregation dashboards.
	•	Complex UI polish, reporting exports, advanced filters.
	•	Real-time collaboration, comments, tasks, notifications.
	•	Full self-serve onboarding/billing portal (unless explicitly added as a task).

4. Product Assumptions
	•	Early stage onboarding is manual: admin creates org/user accounts.
	•	Customers accept “MVP-grade UI”, but will not accept unreliable processing or data leakage.
	•	First paid value comes from a small set of outputs (summary + core insights), not from a large number of screens.

5. Non-Functional Requirements (NFR)

5.1 Security & Data Isolation
	•	Commercially sensitive data is processed and stored.
	•	All DB tables must use RLS (Row Level Security) tied to org_id.
	•	Storage paths and access must be partitioned by org_id.
	•	Secrets never exposed to client-side code.
	•	Audit important admin actions (who created users/orgs; who retried jobs).

5.2 Reliability & Idempotency
	•	Background jobs must be idempotent: re-run should not corrupt data or duplicate outputs.
	•	Transient external API failures must be retried with backoff.
	•	Each processing stage must record:
	•	start/end timestamps
	•	attempt count
	•	last error message
	•	Hard timeouts must prevent infinite hangs.

5.3 Performance & Limits
	•	Enforce upload constraints (size, format, duration).
	•	Concurrency limits for processing to protect VPS and external API quotas.
	•	Avoid processing in HTTP request lifecycle.

5.4 Observability
	•	Structured logs for web and worker.
	•	Correlation ID for every request/job (use call/presentation ID).
	•	Persistent error details in DB for support/debugging.

6. System Architecture (High-Level)

6.1 Components
	•	Web/API service: UI + REST endpoints (or server actions) for upload, status, and results.
	•	Worker service(s): background processing pipeline stages.
	•	Queue: background job queue (e.g., Redis-based) or DB-backed queue (only if designed safely).
	•	Supabase:
	•	Postgres DB: core entities, job tracking, results
	•	Storage: raw uploads + derived artifacts
	•	Auth: authentication + session management

6.2 Data Model (Conceptual)

Core entities:
	•	orgs
	•	profiles (user_id, org_id, role)
	•	calls or presentations (upload records)
	•	processing_jobs (one record per processing run/stage)
	•	artifacts (links to storage objects: audio, transcript, analysis json)

All entities must be scoped by org_id.

6.3 Storage Layout (Guideline)

Use predictable paths:
	•	orgs/{org_id}/calls/{call_id}/raw/...
	•	orgs/{org_id}/calls/{call_id}/artifacts/audio/...
	•	orgs/{org_id}/calls/{call_id}/artifacts/transcript/...
	•	orgs/{org_id}/calls/{call_id}/artifacts/analysis/...

7. Environments & Deployment

Two isolated environments:
	•	Staging
	•	Production

Isolation means:
	•	Separate Supabase projects (preferred).
	•	Separate storage buckets and secrets.
	•	Separate worker queues.
	•	Separate domains/subdomains.

CD rules:
	•	Merge to main → deploy to staging.
	•	Release/tag/manual approval → deploy to production.

DB schema changes:
	•	Only via migrations committed to repo.
	•	CI verifies migrations apply cleanly.
	•	CD applies migrations before app rollout (fail fast on migration errors).

8. Development Process (Antigravity Workflow)

Work is executed as a sequence of small, verifiable increments.

8.1 Definition of Done (DoD) for every task

A task is “done” only if:
	•	Spec and Acceptance Criteria are written.
	•	Unit tests are implemented and pass.
	•	Integration/contract tests (mocking external APIs) exist where applicable.
	•	DB migrations (if needed) are committed.
	•	Logs + job status updates are implemented.
	•	Deployed and verified on staging.

8.2 Task Granularity Rules
	•	One task → one PR.
	•	Each PR must produce a user-visible improvement or an operability improvement.
	•	No “mega-PRs” spanning multiple screens and backend changes unless explicitly approved.

8.3 External APIs Testing Policy
	•	No real SpeechKit v3/OpenAI Agents SDK calls in unit tests.
	•	Implement thin adapters and mock them in tests.
	•	Optional: separate manual “smoke test” script for real API calls.

8.4 Refactoring Policy
	•	Periodic refactoring is expected.
	•	Refactoring must not change product behavior unless explicitly scoped.

9. Risk Register (Initial)

9.1 Manual Onboarding / Admin Needs

Risk: manual steps cause inconsistencies and security gaps.
Mitigation: minimal admin panel + audited admin actions + strict RLS.

9.2 Future Role Model Expansion

Risk: future roles require large rewrite.
Mitigation: introduce org_id, profiles.role and RBAC-ready structure from day one.

9.3 File Processing Complexity

Risk: ffmpeg/transcription/LLM are failure-prone and expensive.
Mitigation: stage-based jobs, retries, timeouts, limits, and clear statuses.

9.4 Environment Cross-Contamination

Risk: staging and prod share resources causing data leaks.
Mitigation: separate Supabase projects, secrets, queues, and domains.

9.5 Cost Blowups

Risk: large files and retries increase SpeechKit v3/OpenAI Agents SDK costs.
Mitigation: file limits, quotas per org, per-stage retry caps, visibility in admin.

10. Milestones (Suggested)
	•	M1 — Foundation: repo + CI/CD + Supabase schema + Auth + RLS.
	•	M2 — Upload & Status: upload flow + job tracking + worker skeleton.
	•	M3 — Processing v1: ffmpeg (if needed) + SpeechKit integration + artifact storage.
	•	M4 — Analysis v1: OpenAI Agents SDK analysis + result persistence + UI display.
	•	M5 — Hardening: retries, limits, observability, admin tools, staging/prod parity.

11. Decision Log (To Be Maintained)

Maintain a short DECISIONS.md with:
	•	key architectural choices (queue tech, worker language/runtime, schema changes)
	•	rationale
	•	date and owner
