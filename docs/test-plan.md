# Test Plan

Strategy, cases and coverage matrix for the AI Career Path & Skill Recommendation System.

---

## 1. Objectives

| # | Objective |
|---|---|
| TP-1 | Authentication is secure and failure modes are correct |
| TP-2 | Role-based access control is enforced by the API, not the UI |
| TP-3 | A candidate can complete a real, timed assessment end to end |
| TP-4 | The server — not the browser — decides timing, scoring and submission |
| TP-5 | Career matching is deterministic, reproducible and explainable |
| TP-6 | The AI layer fails safely and never corrupts deterministic results |
| TP-7 | Candidate data cannot leak between users or roles |
| TP-8 | Empty states are reported honestly, never as fabricated data |
| TP-9 | The production build succeeds with no errors |

---

## 2. Test levels

| Level | Tool | What it covers |
|---|---|---|
| Unit | Vitest | Scoring maths, compatibility algorithm, preference aggregation, AI schema validation, evidence confidence |
| Integration / API | Vitest + Supertest | Full HTTP request → middleware → controller → service → MongoDB |
| End-to-end smoke | `scripts/smoke-test.ts` | 73 checks against a **running** server, exactly as a browser would call it |
| Manual | Browser | Visual, responsive and interaction checks |

Integration tests run against a **dedicated MongoDB database** (`career_guide_test`), dropped between
suites. Real Mongoose behaviour, real indexes and real queries are exercised — the database layer is
never mocked, because mocking it would hide exactly the bugs most likely to matter here.

---

## 3. Test cases

### 3.1 Authentication — `server/src/tests/auth.test.ts` (32 cases)

| ID | Case | Expected |
|---|---|---|
| AU-01 | Register with valid details | 201, role `student`, no `passwordHash` in the response |
| AU-02 | Register with an existing email | 409 |
| AU-03 | Register with a weak password | 422 with a field-level error |
| AU-04 | Register with mismatched confirmation | 422 |
| AU-05 | Register without accepting the disclaimer | 422 |
| AU-06 | Login with valid credentials | 200, `HttpOnly` + `SameSite=Lax` cookies |
| AU-07 | Login with a wrong password | 401 |
| AU-08 | Login with an unknown email | 401, **identical message** (no enumeration) |
| AU-09 | Login to a deactivated account | 403 |
| AU-10 | 8 consecutive failures | account locked, 403 |
| AU-11 | `GET /auth/me` with a session | 200 with the current user |
| AU-12 | `GET /auth/me` without a session | 401 |
| AU-13 | Logout with CSRF | 200, both cookies cleared |
| AU-14 | Logout **without** CSRF | 403 |
| AU-15 | Role change | old session invalidated (401) |
| AU-16 | Password change | other sessions invalidated |
| AU-17 | State-changing request with a cookie but no CSRF header | 403 `CSRF_TOKEN_INVALID` |
| AU-18 | Safe GET without CSRF | 200 (CSRF not required for safe methods) |

### 3.2 Role-based access control

| ID | Case | Expected |
|---|---|---|
| RB-01 | Unauthenticated `GET /users` | 401 |
| RB-02 | Student `GET /users` | 403 |
| RB-03 | Management `POST /questions` | 403 |
| RB-04 | Counsellor `PUT /settings` | 403 |
| RB-05 | Management `GET /audit-logs` | 403 |
| RB-06 | Admin full access | 200 on all admin endpoints |
| RB-07 | Counsellor user list | contains only their assigned candidates |
| RB-08 | Management opening a candidate record | 403 (not merely filtered from a list) |
| RB-09 | Sole admin deactivating self | 400 |
| RB-10 | Sole admin demoting self | 400 |
| RB-11 | Deactivate a second admin | 200; the victim's session immediately 403 |
| RB-12 | Deactivate a candidate with a live attempt | 409 |
| RB-13 | `X-Powered-By` header | absent |

### 3.3 Assessment workflow — `server/src/tests/assessment.test.ts` (29 cases)

| ID | Case | Expected |
|---|---|---|
| AS-01 | Candidate sees published, in-window test sets only | draft hidden |
| AS-02 | Starting an unpublished test set | 403 |
| AS-03 | Create attempt | `expiresAt` ≈ start + duration, within tolerance |
| AS-04 | Attempt payload | contains **no** `correctOptionId`, `explanation` or `skillMappings` |
| AS-05 | Refresh mid-attempt | same attempt id, same `expiresAt`, decreasing `secondsRemaining`, one attempt row |
| AS-06 | Save a question not in the attempt | 400 |
| AS-07 | Save answers | `answeredCount` computed server-side and reflected on reload |
| AS-08 | Answer all correctly | marks, total, percentage and pass flag all correct |
| AS-09 | Partial answers | unanswered items stay in the denominator |
| AS-10 | Preference instrument | `scoringModel: 'preference'`, percentage/marks/passed are `null`, dimensions aggregated |
| AS-11 | Malformed item (no answer key) | flagged `invalid`, excluded from the denominator, `scorableMarks` reported, reason shown, **no answer invented** |
| AS-12 | Response matching no option | flagged `invalid` |
| AS-13 | Double submission after mutating stored answers | original score unchanged |
| AS-14 | Answer change after submission | 409 |
| AS-15 | Save after the deadline | 410, attempt auto-submitted, saved answers scored |
| AS-16 | Expiry sweep with no client action | attempt finalised as `auto_submitted` |
| AS-17 | Attempt limit exceeded | 403 |
| AS-18 | `finaliseAttempt` called twice | second call is a no-op |
| AS-19 | Candidate reads another candidate's attempt | 404 on attempt, result and submit |
| AS-20 | Completed attempt updates the skill profile | measurement, evidence, observations, revision |
| AS-21 | Two attempts | evidence-weighted mean of 100 and 0 = 50; history retained; both attempts still present |
| AS-22 | Unsubmitted attempt | no profile or revision created |
| AS-23 | History | completed only, live excluded, correct ordering |
| AS-24 | Re-request while live | returns the same attempt, no second one created |
| AS-25 | Delete a question used in an attempt | 409 |
| AS-26 | Delete an assessment with attempts | 409 ("archive instead") |
| AS-27 | Edit scoring data of a used question | 409 |
| AS-28 | Publish with an insufficient pool | 422 |
| AS-29 | Career referencing a non-existent skill | 422 |

### 3.4 Compatibility algorithm — `server/src/tests/recommendation.test.ts` (18 cases)

| ID | Case | Expected |
|---|---|---|
| CA-01 | All requirements exceeded | score 100, confidence `good` |
| CA-02 | All requirements unmet | score 0, all gaps listed |
| CA-03 | Identical input twice | **identical score and evidence** (reproducibility) |
| CA-04 | Low-evidence measurement near the threshold | damped below the well-evidenced equivalent, never zeroed |
| CA-05 | Part of the role unmeasured | `dataCoverage` correct, bounded penalty applied, requirement reported `unmeasured` |
| CA-06 | Unmeasured skill never listed as a strength | ✓ |
| CA-07 | Nothing measured | score 0, `insufficientData: true`, summary says limited evidence |
| CA-08 | Aptitude data absent | remaining weights re-normalised, score not diluted |
| CA-09 | Deterministic summary | always non-empty and human-readable |
| CA-10 | `weightedDimensionMatch` | correct weighted mean; `null` when nothing declared |
| CA-11 | Documented weights | sum to 1 |
| CA-12 | Ranking | by score, then coverage |
| CA-13 | Evidence confidence curve | 0 → 0, 10 → 1, monotonic |
| CA-14 | Preference extremes | +max → 100, neutral → 50, −max → 0 |
| CA-15 | Preference items excluded from the objective total | objective marks stay 0 |
| CA-16 | Percentage with a zero denominator | 0, no `NaN` |
| CA-17 | AI schema | valid accepted; too-short, wrong-typed and empty-array narratives rejected |

### 3.5 Report generation and the AI layer (12 cases)

| ID | Case | Expected |
|---|---|---|
| RG-01 | No AI provider configured | complete report, `aiProviderUsed: 'none'`, reason recorded, every recommendation still has a deterministic explanation, disclaimer present |
| RG-02 | Valid AI narrative | attached to recommendations, provider and latency recorded |
| RG-03 | AI invents a career reference | reference stripped; narrative discarded entirely; scoring unaffected |
| RG-04 | AI throws | graceful fallback; deterministic report still complete |
| RG-05 | Report already up to date | reused, no second document |
| RG-06 | `forceRegenerate` | new report created |
| RG-07 | No evidence yet | report still generated, `completedAssessments: 0` — no invented figures |
| RG-08 | Empty career catalogue | explicit error |
| RG-09 | Report ownership over HTTP | owner 200, another candidate 403 for both view and download |
| RG-10 | Report generation for another candidate | 403 |
| RG-11 | Printable HTML report | `text/html`, contains the score heading and the limitations block |
| RG-12 | CSV export | 403 for a student, 200 with the right content type for an admin |

### 3.6 Skill profile and roadmaps (7 cases)

| ID | Case | Expected |
|---|---|---|
| SP-01 | Skill profile after one attempt | measurement created with the correct score |
| SP-02 | Two attempts | evidence-weighted mean; history and both attempts preserved |
| SP-03 | Unsubmitted attempt | no profile written |
| SP-04 | Profile with no data | `empty: true`, `measurements: []` |
| SP-05 | Roadmaps generated | start at 0 % with every item `not_started` and no milestone complete |
| SP-06 | Candidate marks an item complete | percentage increases, `completedAt` set |
| SP-07 | Candidate updates another's roadmap | 403 |

### 3.7 End-to-end smoke test — `scripts/smoke-test.ts` (73 checks)

Runs against a live server over HTTP, exactly as the browser does: health, public settings,
authentication, CSRF, full attempt lifecycle for every published test set (create → refresh → save →
submit → duplicate submission → post-submission edit), skill profile updates, compatibility preview,
report generation and download, roadmap progress, and the four-role authorisation matrix.

### 3.8 Manual / browser checks

| ID | Check | Expected |
|---|---|---|
| MB-01 | Refresh mid-assessment | timer continues from the server deadline; answers intact |
| MB-02 | Let the timer expire | auto-submits; result screen explains why |
| MB-03 | Resize to 375 px | no horizontal overflow; sidebar collapses to a drawer |
| MB-04 | Keyboard only | visible focus ring on every interactive element |
| MB-05 | Screen reader landmarks | one `h1`, labelled nav, `role="alert"` on errors |
| MB-06 | Report print preview | clean layout, no navigation chrome |
| MB-07 | AI unconfigured | report clearly labelled "Deterministic"; no false AI claim |
| MB-08 | Browser console during a full flow | no errors or warnings |

---

## 4. Coverage matrix

| Requirement | Unit | Integration | Smoke | Manual |
|---|:--:|:--:|:--:|:--:|
| Registration / duplicate email / validation | ✓ | ✓ | ✓ | |
| Login, logout, lockout, enumeration resistance | ✓ | ✓ | ✓ | |
| Password hashing and reset | ✓ | ✓ | | |
| CSRF protection | ✓ | ✓ | ✓ | |
| Role-based access control | | ✓ | ✓ | ✓ |
| Ownership isolation | | ✓ | ✓ | |
| Attempt creation and refresh safety | ✓ | ✓ | ✓ | ✓ |
| Server-authoritative timer | ✓ | ✓ | ✓ | ✓ |
| Duplicate submission prevention | ✓ | ✓ | ✓ | |
| Post-submission immutability | ✓ | ✓ | ✓ | |
| Objective scoring | ✓ | ✓ | ✓ | |
| Malformed-item handling | ✓ | ✓ | | |
| Preference scoring | ✓ | ✓ | ✓ | |
| Skill profile updates and history | ✓ | ✓ | ✓ | |
| Deterministic compatibility scoring | ✓ | ✓ | ✓ | |
| Missing-data handling | ✓ | ✓ | | |
| Unsupported AI career references | ✓ | ✓ | | |
| Invalid AI response | ✓ | ✓ | | |
| AI provider failure | ✓ | ✓ | | |
| Deterministic fallback | ✓ | ✓ | ✓ | ✓ |
| Report authorisation | | ✓ | ✓ | |
| Roadmap progress semantics | ✓ | ✓ | ✓ | |
| Question / test-set authoring rules | | ✓ | ✓ | |
| Analytics scope and privacy | ✓ | ✓ | | |
| Empty states (no fabricated data) | ✓ | ✓ | ✓ | ✓ |
| Responsive layout / accessibility | | | | ✓ |
| Production build | | ✓ | | |

---

## 5. Out of scope

Load testing, cross-browser matrix testing, penetration testing, and automated accessibility
auditing with a screen reader are **not** covered by automated tests. Performance and accessibility
are verified manually as documented in [`test-results.md`](test-results.md).

---

## 6. How to run

```bash
npm test                          # 97 automated tests
npm run test:watch                # watch mode
npm run test:coverage             # V8 coverage report
npx tsx scripts/smoke-test.ts     # 73 checks against a running server
npm run typecheck                 # server + client
npm run build                     # production builds
```
