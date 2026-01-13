# Task Template (Antigravity-ready)

Use this template for every task/issue. One task = one PR.
Do not start implementation until Spec + AC + Test Plan are written and reviewed.

---

## Title
<Short imperative title. Example: "Implement uploads list page with job statuses">

## Goal (user value)
One sentence describing what the user/admin can do after this task.

## Scope
### In
- Bullet list of what is included.

### Out
- Bullet list of what is explicitly excluded (to prevent scope creep).

## Background / Context
Why we need this now. Link to relevant decisions (DECISIONS.md) and prior PRs/issues.

## UX / Screens (if applicable)
- Screen(s): <Login / Settings / List / Presentation / etc.>
- Empty states: what the user sees when there is no data.
- Error states: what the user sees on failure.
- Loading/progress states: what the user sees while processing.

## Acceptance Criteria (AC)
Write verifiable statements. Prefer 5–12 bullets.
Examples:
- [ ] User can upload a file up to X MB and sees a new record in the list.
- [ ] Job status transitions: queued → processing → done OR failed.
- [ ] If a job fails, UI displays error message and provides a retry action.
- [ ] RLS prevents accessing resources from another org.

## Data Model / Migrations
- Tables affected:
  - `...`
- New columns:
  - `...`
- Indexes/constraints:
  - `...`
- RLS policies updated/added:
  - `...`
- Migration files:
  - `...` (names)

## API / Contracts
- Endpoints or server actions:
  - `METHOD /path` — request/response summary
- DTO / schema changes:
  - JSON schema, validation rules
- Idempotency:
  - idempotency key definition (if relevant)

## Processing / Workers (if applicable)
- Queue name/topic:
- Job payload:
- Retries/backoff:
- Timeouts:
- Concurrency limits:
- Idempotency behavior:
- Artifact outputs (storage paths):
  - `orgs/{org_id}/calls/{call_id}/artifacts/...`

## Security
- Auth assumptions:
- RLS checks:
- Admin-only actions:
- Secrets/env vars added or modified:

## Observability
- Correlation ID:
- Logs added (what events are logged):
- Metrics (optional):
- Job error persistence (where stored):

## Test Plan
### Unit tests
- What modules are tested and what is mocked.

### Integration tests
- What is verified end-to-end (can run locally/CI without real external APIs).

### Manual smoke test
Exact steps a human can run on staging to verify:
1) ...
2) ...
3) ...

## Rollout / Migration Plan
- Backward compatibility:
- Deploy steps:
- Any data backfills needed:
- Feature flags (if used):

## Risks & Mitigations
- Risk:
- Mitigation:

## Definition of Done (DoD)
- [ ] Spec + AC + Test Plan complete
- [ ] Unit tests pass in CI
- [ ] Lint/format pass in CI
- [ ] DB migrations applied successfully on staging
- [ ] RLS verified (tests or manual proof)
- [ ] Logs/status updates implemented
- [ ] Staging manual smoke test completed
- [ ] PR merged with a short changelog entry

## Links
- Related issues:
- PR:
- Miro screenshot / requirement reference:
- Decision(s):
