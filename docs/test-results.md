# Test Results

**Every figure below was produced by actually running the commands shown.** Nothing here is
estimated or assumed. Where something was not tested, it is stated as not tested.

- **Project:** AI Career Path &amp; Skill Recommendation System
- **Date of run:** 10 October 2026
- **Environment:** Windows 11 · Node.js v24.11.1 · npm 11.6.2 · MongoDB 8.x on `127.0.0.1:27017`
- **Verdict:** ✅ All automated tests pass · ✅ End-to-end smoke test passes · ✅ Both production builds succeed

---

## 1. Summary

| Suite | Command | Result |
|---|---|---|
| Automated tests | `npm test` | ✅ **118 passed, 0 failed** (4 files) |
| AI provider tests | `npx vitest run src/tests/aiProvider.test.ts` | ✅ **21 passed** |
| End-to-end smoke | `npx tsx scripts/smoke-test.ts` | ✅ **73 passed, 0 failed** |
| Server typecheck | `npm run typecheck --workspace server` | ✅ 0 errors |
| Client typecheck | `npm run typecheck --workspace client` | ✅ 0 errors |
| Server build | `npm run build --workspace server` | ✅ `tsc` clean → `server/dist` |
| Client build | `npm run build --workspace client` | ✅ Vite bundle built |

---

## 2. Automated test suite

```
$ npm test

 Test Files  4 passed (4)
      Tests  118 passed (118)
   Duration  91.43s
```

| File | Tests | Focus |
|---|---|---|
| `src/tests/auth.test.ts` | 32 | Registration, login, sessions, CSRF, RBAC, lockout |
| `src/tests/assessment.test.ts` | 29 | Attempt lifecycle, timing, scoring, skill profiles, authoring rules |
| `src/tests/recommendation.test.ts` | 35 | Compatibility algorithm, preference aggregation, report pipeline, AI validation |
| `src/tests/aiProvider.test.ts` | 21 | Provider HTTP transport, timeouts, error mapping, JSON extraction |

The suite runs against a real dedicated MongoDB database (`career_guide_test`), dropped between
suites. The database layer is never mocked, so indexes, validation and query behaviour are genuinely
exercised.

---

## 3. Code coverage (`npx vitest run --coverage`)

### 3.1 Overall

| Metric | Value |
|---|---|
| Statements | **74.11 %** |
| Branches | **67.96 %** |
| Functions | **74.15 %** |
| Lines | **74.11 %** |

### 3.2 Core business logic — the part that matters most

| Module | Statements | Branches | Functions | Verdict |
|---|---|---|---|---|
| `services/careers/compatibilityService.ts` | **97.08 %** | 85.36 % | 100 % | Excellent |
| `services/recommendations/recommendationService.ts` | **94.08 %** | 81.60 % | 100 % | Excellent |
| `services/assessments/skillProfileService.ts` | **92.76 %** | 55.81 % | 75 % | Good |
| `services/assessments/attemptService.ts` | **92.00 %** | 79.72 % | 90.90 % | Good |
| `services/assessments/scoringService.ts` | **91.13 %** | 82.75 % | 100 % | Good |
| `services/audit/auditService.ts` | **97.46 %** | 90.90 % | 100 % | Excellent |
| `services/ai/GeminiProvider.ts` | **100 %** | 92.30 % | 100 % | Excellent |
| `services/ai/OpenAIProvider.ts` | **91.30 %** | 73.33 % | 100 % | Good |
| `services/ai/AIProvider.ts` | **88.88 %** | 80.76 % | 100 % | Good |
| `services/recommendations/roadmapService.ts` | **79.42 %** | 68.57 % | 80 % | Acceptable |

Every scoring and matching rule is directly unit-tested and independently reproducible.

### 3.3 Infrastructure

| Module | Statements | Notes |
|---|---|---|
| `routes/v1.routes.ts` | **100 %** | Every route is mounted and reachable |
| `routes/auth.routes.ts` | **100 %** | |
| `models/*` (12 schemas) | 98.51 % avg | Schema definitions and indexes |
| `middleware/validate.ts` | **100 %** | |
| `middleware/csrf.ts` | **100 %** | |
| `middleware/requestLogger.ts` | **100 %** | |
| `config/constants.ts` | **100 %** | Permission matrix |

### 3.4 Lower coverage — explained honestly

| Module | Statements | Why |
|---|---|---|
| `controllers/*` | 56.51 % avg | Thin HTTP adapters; the logic they delegate to is well covered. CRUD branches are exercised mainly through the smoke test rather than unit tests. |
| `services/analytics/analyticsService.ts` | 32.88 % | Aggregations are verified by the smoke test and by reading real dashboard responses; dedicated unit tests were not written. **This is a genuine gap.** |
| `jobs/attemptSweep.ts` | 0 % | The wrapper is trivial; the sweep logic inside `attemptService` **is** covered by test AS-16. |
| `services/auth/bootstrapService.ts` | 0 % | Only runs when the database has no administrator. Exercised manually at first start. |
| `services/ai/aiProviderRegistry.ts` | 53.17 % | The live-provider branch needs a real API key; the no-provider path is covered. |
| `config/permissions.ts` | 33.33 % | Helper functions; the matrix itself is exercised through every RBAC test. |

**Not covered by automated tests** and verified manually or by the smoke test only: analytics
aggregations, question/test-set CRUD screens, settings updates, report HTML rendering edge cases,
and the management export contents beyond one response check.

---

## 4. End-to-end smoke test

```
$ npx tsx scripts/smoke-test.ts

  73 passed, 0 failed
```

Run against a live server over HTTP, exactly as the browser calls it.

| Area | Checks | Result |
|---|---|---|
| Health and public settings | 2 | ✅ |
| Authentication (login, invalid credentials, CSRF) | 5 | ✅ |
| Attempt lifecycle — every published test set | 5 × 6 = 30 | ✅ |
| Skill profile, compatibility preview | 2 | ✅ |
| Report generation, retrieval, printable download | 4 | ✅ |
| Roadmaps (initial state and progress) | 3 | ✅ |
| Cross-candidate access denial | 1 | ✅ |
| Role authorisation matrix (student / counsellor / management / admin) | 12 | ✅ |
| Validation and 404 handling | 2 | ✅ |
| **Total** | **73** | ✅ |

Notable confirmations from this run:

- Draft test sets are invisible to candidates.
- Question payloads never contain `correctOptionId`.
- Refreshing returns the same attempt with the timer intact.
- A second submission is rejected; post-submission edits return `409`.
- Every recommendation carries a deterministic explanation even with **no** AI provider configured.
- Roadmaps start at 0 % — nothing is pre-completed.
- Another candidate is refused the report (`403`), and the UI/API boundary holds.

---

## 5. Bugs found and fixed during testing

Recorded because they demonstrate the tests are doing real work.

| # | Bug found | How | Fix |
|---|---|---|---|
| 1 | `answeredCount` always 0 — answers saved but the `isAnswered` flag was never set, so the counter derived from it was wrong | Smoke test | `saveAnswers` now sets `isAnswered` alongside the selection |
| 2 | Roadmap items exposed as `_id`, inconsistent with the `id` used everywhere else | Smoke test | Added `serialiseRoadmap` so every API object uses `id` |
| 3 | Counsellors could not list their assigned students | Smoke test | Granted `users:read`; the query still hard-scopes to their own candidates |
| 4 | `mongoose.set('sanitizeFilter', true)` broke the expiry sweep (`Cast to date ... $lte`) | Server start-up log | Removed it; protection comes from Zod validation, documented in `app.ts` |
| 5 | A malformed item was excluded from scoring but the result still showed the nominal total, so 100 % looked like it covered the whole test | Unit test | Added `scorableMarks` to the model, the API and the UI so the reduced denominator is stated explicitly |
| 6 | Unknown-career filtering lived only inside the AI provider wrapper — replacing the generator would have let a fabricated career through | Unit test | Moved/duplicated the allow-list into `recommendationService` so the invariant holds regardless of the generator |
| 7 | `MongooseServerSelectionError` formatting | — | Resolved by fix 4 |

Two "failures" turned out to be **correct behaviour that the test asserted wrongly**, and the tests
were corrected rather than the code: reusing a live attempt instead of creating a second one, and
confidence reflecting requirement coverage rather than evidence volume.

---

## 6. Manual verification

Performed in a browser against the running application.

| ID | Check | Result |
|---|---|---|
| MB-01 | Registration → sign-in → dashboard renders with real database data | ✅ |
| MB-02 | Full assessment: instructions → attempt → timer → answers save → submit → result with per-skill analysis and answer review | ✅ |
| MB-03 | Refresh mid-assessment — attempt and remaining time preserved | ✅ |
| MB-04 | Career report generated and displayed with ranked options and an evidence table | ✅ |
| MB-05 | Printable report downloads and opens as formatted HTML | ✅ |
| MB-06 | Roadmap item marked complete → progress percentage updates | ✅ |
| MB-07 | Frontend talks to the backend through the Vite proxy on one origin; session cookie works | ✅ |
| MB-08 | Admin, counsellor and management workspaces load with their own navigation and data | ✅ |
| MB-09 | Draft test set hidden from candidates, visible to admin | ✅ |
| MB-10 | AI unconfigured → report clearly labelled "Deterministic", no false AI claim | ✅ |

**Not verified** (stated plainly):

- Real-device testing on physical phones — responsive layout verified only by CSS review.
- Screen-reader walkthrough — semantic markup and ARIA attributes are present but were not audited
  with an actual screen reader.
- Load/performance testing — no k6 or similar was run.
- Cross-browser matrix — only the Chromium-based dev environment was used.
- Penetration testing — no third-party security audit was performed.

---

## 7. Requirement coverage against "Definition of Done"

| Requirement | Status | Evidence |
|---|---|---|
| Installable from documented instructions | ✅ | `docs/setup-guide.md`, verified end to end |
| Frontend starts | ✅ | `npm run dev` → :5173 |
| Backend starts | ✅ | `npm run dev` → :5000 |
| MongoDB connectivity verified | ✅ | `/health` reports `database: connected` |
| Registration and login work | ✅ | AU-01…AU-09 |
| Four roles with appropriate permissions | ✅ | RB-01…RB-13, smoke role matrix |
| Unauthorised API calls rejected | ✅ | 401 unauthenticated, 403 unauthorised |
| Question bank and test-set management | ✅ | Smoke + AS-25…AS-29 |
| A candidate can complete a real assessment | ✅ | Full lifecycle in smoke + AS-03…AS-24 |
| Timing and evaluation enforced on the server | ✅ | AS-05, AS-15, AS-16, AS-18 |
| Results persist in MongoDB | ✅ | Asserted against the database |
| Skill profiles update from assessments | ✅ | SP-01, SP-02, SP-03 |
| Compatibility scores reproducible | ✅ | CA-03 (identical input → identical output) |
| AI explanations validated | ✅ | CA-17, RG-02, RG-03, AI provider suite |
| Missing AI credentials handled honestly | ✅ | RG-01, RG-04, MB-10 |
| Reports use real candidate data | ✅ | Reports assert against DB-derived measurements |
| Historical results remain available | ✅ | SP-02, AS-20 |
| Application builds successfully | ✅ | Both builds clean |
| Automated tests executed and recorded | ✅ | 118 passed — this document |
| Core workflows tested end to end | ✅ | 73 smoke checks |
| Setup and deployment instructions complete | ✅ | `docs/setup-guide.md`, `docs/deployment-guide.md` |
| No secrets or production credentials committed | ✅ | `.env` gitignored; `.env.example` placeholders only |
| No core workflow is a placeholder | ✅ | All documented features implemented |

---

## 8. Reproducing these results

```bash
git clone <repository-url>
cd ai-career-path-skill-recommendation-system
npm install

cp server/.env.example server/.env      # set MONGODB_URI and JWT_SECRET
npm run seed

# Terminal 1 - automated tests (uses career_guide_test, drops it between suites)
npm test

# Terminal 2 - live application
npm run dev

# Terminal 3 - end-to-end smoke test
npx tsx scripts/smoke-test.ts

npm run typecheck
npm run build
```

Expected output on a healthy install:

```
Test Files  4 passed (4)
     Tests  118 passed (118)

  73 passed, 0 failed
```

> Note: if `npm` reports `Dynamic require of "child_process" is not supported`, a VS Code debug
> preload is set in `NODE_OPTIONS`. Clear it with `$env:NODE_OPTIONS = ""` (PowerShell) or
> `unset NODE_OPTIONS` (macOS/Linux) and retry.
