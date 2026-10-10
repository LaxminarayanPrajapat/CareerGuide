# API Documentation

Base URL: `http://localhost:5000/api/v1` (development)

All responses use one envelope:

```jsonc
// success
{ "success": true, "message": "OK", "data": { }, "meta": { } }

// error
{ "success": false, "message": "Human readable reason",
  "data": null,
  "errors": [ { "field": "password", "message": "..." } ],   // 422 only
  "meta": { "code": "VALIDATION_ERROR", "timestamp": "...", "path": "/api/v1/..." } }
```

`meta.code` is a stable machine-readable identifier — branch on it, not on the message text.

---

## Authentication model

| Aspect | Behaviour |
|---|---|
| Session | JWT in the `cgs_session` cookie — `HttpOnly`, `SameSite=Lax`, `Secure` when `COOKIE_SECURE=true` |
| CSRF | A readable `cgs_csrf` cookie is issued at sign-in. Every state-changing request must send it back in `X-CSRF-Token`. |
| Revocation | `tokenVersion` on the user; a role change, deactivation or password change invalidates all existing sessions immediately. |
| Expiry | `JWT_EXPIRES_IN` (default `2h`) |

Example:

```bash
curl -c cookies.txt -X POST http://localhost:5000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"student@careerguide.local","password":"Student@12345"}'

curl -b cookies.txt -H "X-CSRF-Token: $(grep cgs_csrf cookies.txt | awk '{print $7}')" \
  -X POST http://localhost:5000/api/v1/reports/generate -H 'Content-Type: application/json' -d '{}'
```

---

## Status codes

| Code | Meaning |
|---|---|
| `200` / `201` | Success |
| `400` | Malformed request or business-rule violation |
| `401` | Not authenticated, or the session is invalid/expired |
| `403` | Authenticated but the role or ownership check failed |
| `404` | Resource not found (also used to avoid leaking existence) |
| `409` | Conflict — duplicate key, or a state change that is no longer allowed |
| `410` | Gone — the attempt's server deadline has passed |
| `422` | Schema validation failed (with per-field errors) |
| `429` | Rate limited |
| `500` / `503` | Server error / database unavailable |

---

## Endpoint index

### Public

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Liveness + database status (outside `/api/v1`) |
| `GET` | `/settings/public` | Site name and assessment notice, no auth |

### Authentication

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/register` | — | Create a candidate account (always role `student`) |
| `POST` | `/auth/login` | — | Sign in, sets session + CSRF cookies |
| `POST` | `/auth/logout` | cookie | Clear cookies |
| `GET` | `/auth/me` | ✔ | Current user and effective permissions |
| `PATCH` | `/profile` | ✔ | Update own name, phone and academic details |
| `POST` | `/auth/change-password` | ✔ | Change password; invalidates other sessions |
| `POST` | `/auth/forgot-password` | — | Request a reset token |
| `POST` | `/auth/reset-password` | — | Consume a reset token |

### Reference data (any authenticated role)

| Method | Path | Permission | Description |
|---|---|---|---|
| `GET` | `/skills` | — | Skill catalogue (paginated, filterable) |
| `GET` | `/careers` | `careers:read` | Career catalogue |
| `GET` | `/careers/:id` | `careers:read` | One career with its full requirement table |
| `GET` | `/assessment-categories` | — | The five assessment categories |

### Assessments and attempts

| Method | Path | Permission | Description |
|---|---|---|---|
| `GET` | `/assessments` | — | Test sets (candidates see published & in-window only) |
| `GET` | `/assessments/:id` | — | One test set with instructions |
| `GET` | `/attempts/available` | `attempts:take` | Test sets with this candidate's attempt state |
| `POST` | `/attempts` | `attempts:take` | Start (or resume) an attempt |
| `GET` | `/attempts/:id` | `attempts:read-own` | Attempt payload — **never includes answer keys** |
| `PUT` | `/attempts/:id/answers` | `attempts:take` | Save/clear answers and flags |
| `POST` | `/attempts/:id/submit` | `attempts:take` | Submit and score; idempotent |
| `GET` | `/attempts/:id/result` | `attempts:read-own` | Result, per-skill analysis and answer review |
| `GET` | `/attempts/history` | `attempts:read-own` | Completed attempts, paginated |

### Reports, compatibility and roadmaps

| Method | Path | Permission | Description |
|---|---|---|---|
| `GET` | `/compatibility` | — | Live deterministic matches for the caller |
| `GET` | `/compatibility/:id` | — or `reports:read-assigned` | Matches for one career |
| `POST` | `/reports/generate` | `reports:generate-own` | Generate a career report (+ optional roadmaps) |
| `GET` | `/reports` | `reports:read-own` | Own reports; `?candidateId=` for assigned candidates |
| `GET` | `/reports/:reportNumber` | `reports:read-own` | Full report |
| `GET` | `/reports/:reportNumber/download` | `reports:read-own` | Printable HTML (print / save as PDF) |
| `GET` | `/roadmaps` | — | Roadmaps (own, or `?candidateId=` for assigned) |
| `GET` | `/roadmaps/:id` | — | One roadmap |
| `PATCH` | `/roadmaps/:id/items/:itemId` | `roadmaps:manage-own` | Set item status — the only way progress changes |
| `GET` | `/profile/skill-profile` | — | Structured skill profile + revision history |

### Analytics

| Method | Path | Permission | Returns |
|---|---|---|---|
| `GET` | `/analytics/self` | `analytics:self` | Candidate dashboard |
| `GET` | `/analytics/candidates/:id` | `analytics:self` or `reports:read-assigned` | One candidate's dashboard |
| `GET` | `/analytics/progression` | — | Skill progression (explicitly empty when single-observation) |
| `GET` | `/analytics/trend` | — | Monthly completion trend |
| `GET` | `/analytics/groups` | — | Batches and departments for filters |
| `GET` | `/analytics/students` | `analytics:assigned` or admin | Student directory, scoped |
| `GET` | `/analytics/institution` | `analytics:institution` | **Aggregate only** institutional analytics |
| `GET` | `/analytics/counsellor` | `analytics:assigned` | Assigned-batch analytics |
| `GET` | `/analytics/system` | `analytics:system` | Platform counts (admin) |
| `GET` | `/exports/analytics.csv` | `exports:download` | CSV of the same figures the user can already see |

### Administration

| Method | Path | Permission |
|---|---|---|
| `GET`/`POST` | `/users` | `users:read` / `users:write` |
| `GET`/`PATCH`/`DELETE` | `/users/:id` | `users:read` / `users:write` |
| `PATCH` | `/users/:id/status` | `users:manage-status` |
| `PATCH` | `/users/:id/counsellor` | `users:write` |
| `POST` | `/users/:id/reset-password` | `users:manage-status` |
| `GET` | `/users/permissions` | `settings:read` — the server permission matrix |
| `GET`/`POST` | `/questions` | `questions:read` / `questions:write` |
| `GET`/`PATCH`/`DELETE` | `/questions/:id` | `questions:read` / `questions:write` / `questions:delete` |
| `PATCH` | `/questions/:id/status` | `questions:write` |
| `POST`/`PATCH` | `/assessments`, `/assessments/:id` | `assessments:write` |
| `PATCH` | `/assessments/:id/status` | `assessments:publish` |
| `DELETE` | `/assessments/:id` | `assessments:write` (refused if attempts exist) |
| `POST`/`PATCH`/`DELETE` | `/skills`, `/skills/:id` | `skills:write` |
| `POST`/`PATCH`/`DELETE` | `/careers`, `/careers/:id` | `careers:write` |
| `GET`/`POST`/`PATCH` | `/categories`, `/categories/:id` | `categories:read` / `categories:write` |
| `GET`/`PUT` | `/settings` | `settings:read` / `settings:write` |
| `GET` | `/audit-logs` | `audit:read` |

### Supervisor views

| Method | Path | Permission |
|---|---|---|
| `GET` | `/supervisor/attempts/:id` | `attempts:read-all` (ownership re-checked) |
| `GET` | `/supervisor/reports` | `reports:read-assigned` |

---

## Worked examples

### Start an attempt

```http
POST /api/v1/attempts
{ "assessmentId": "6a1b2c3d4e5f6a7b8c9d0e1f" }
```

```jsonc
{
  "success": true,
  "data": {
    "attempt": {
      "id": "6a1b...", "status": "in_progress",
      "startedAt": "2026-01-01T10:00:00Z",
      "expiresAt": "2026-01-01T10:20:00Z",   // authoritative deadline
      "serverTime": "2026-01-01T10:00:02Z",  // for client clock-skew correction
      "secondsRemaining": 1198,
      "isFinalised": false
    },
    "questions": [
      { "id": "...", "text": "...", "topic": "...", "questionType": "mcq",
        "options": [ { "optionId": "c", "text": "..." } ],
        "marks": 1, "displayIndex": 1 }
    ],
    "savedAnswers": []
  }
}
```

Note what is **absent**: `correctOptionId`, `explanation`, `skillMappings`.

### Save answers

```http
PUT /api/v1/attempts/{id}/answers
{ "answers": [
    { "questionId": "...", "selectedOptionId": "b", "isFlagged": true },
    { "questionId": "...", "selectedOptionId": "c" }
] }
```

```jsonc
{ "data": { "answeredCount": 2, "flaggedCount": 1, "secondsRemaining": 980 } }
```

Counters are recomputed from the database, never trusted from the client.

Responses: `200` saved · `409` attempt already submitted · `410` deadline passed (auto-submitted).

### Result

```jsonc
{
  "data": {
    "scoringModel": "objective",
    "status": "submitted",
    "marksObtained": 7,
    "totalMarks": 8,       // nominal
    "scorableMarks": 8,    // denominator actually used
    "percentage": 87.5,
    "passed": true,
    "invalidItemCount": 0,
    "skillResults": [ { "skillName": "Logical Reasoning", "score": 87.5, "marksObtained": 7, "marksPossible": 8 } ],
    "review": [ { "questionId": "...", "isCorrect": true, "marksAwarded": 1, "explanation": "..." } ]
  }
}
```

For a preference instrument: `scoringModel: "preference"`, `percentage/marksObtained/passed` are
`null`, and `preferenceResults[]` carries dimension scores where 50 means "no preference expressed".

### Generate a report

```http
POST /api/v1/reports/generate
{ "includeRoadmaps": true, "roadmapCount": 3, "forceRegenerate": false }
```

```jsonc
{
  "data": {
    "reportId": "CGR-20260115-0001",
    "reused": false,
    "scoringVersion": "compatibility-v1.0.0",
    "ai": { "available": false, "providerUsed": "none",
            "failureReason": "No AI provider is configured." },
    "completedAssessments": 5,
    "dataCoverage": 0.79,
    "recommendations": [ { "slug": "full-stack-developer", "title": "Full Stack Developer",
                           "compatibilityScore": 71.2 } ]
  }
}
```

`reused: true` means the stored report already matches the current skill profile revision.

### Compatibility preview

```http
GET /api/v1/compatibility
```

Returns the ranked matches with a per-requirement evidence table:

```jsonc
{ "data": { "scoringVersion": "compatibility-v1.0.0",
  "matches": [ { "title": "Data Analyst", "compatibilityScore": 78, "confidence": "good",
    "dataCoverage": 0.85, "skillFitScore": 76.4, "aptitudeFitScore": 80,
    "evidence": [ { "skillName": "Statistics", "requiredLevel": 60, "measuredLevel": 71,
                    "weight": 0.31, "state": "measured", "gap": 0,
                    "note": "71 measured versus 60 required - a gap of 0 points (well-evidenced)." } ],
    "gaps": [ { "skillName": "Machine Learning", "gap": 18.4, "priority": "high" } ],
    "insufficientData": false,
    "deterministicSummary": "Career compatibility score 78 out of 100 (good confidence, 85% of ...)" } ] } }
```

---

## Validation rules worth knowing

| Field | Rule |
|---|---|
| `password` | ≥ 8 chars with upper, lower, digit and special character |
| `email` | Normalised to lowercase, unique |
| MCQ question | ≥ 2 options, unique option ids, `correctOptionId` must match an option |
| Preference question | Must declare `preferenceDimension` and `scaleMin < scaleMax`; every option needs `preferencePoints` |
| Assessment | `questionCount ≤ questionPool.length`; `availableUntil > availableFrom` |
| Publication | Refused with `422` unless enough active questions exist |
| Roadmap item status | `not_started` \| `in_progress` \| `completed` |

---

## Rate limits

| Scope | Limit |
|---|---|
| `/api/*` general | 300 per 15 min per account/IP |
| `/auth/login`, `/register`, `/change-password`, password reset | 10 per 15 min |
| `POST /reports/generate` | 6 per minute |

Limits are disabled under `NODE_ENV=test` so the automated suite is unaffected.

---

## Audit behaviour

Recorded events include sign-in/out, failed logins, account locks, role and status changes, password
resets, attempt start/submit, report generation/view/download and roadmap updates. Metadata is
restricted to a fixed allow-list of primitive fields — raw answers, passwords and tokens are never
persisted in the log.
