# Viva Preparation

Likely questions with defensible answers. Be ready to be challenged on the **limitations** — being
candid about those is worth more than defending them.

---

## 1. One-minute summary

> "This is a MERN web application that turns a candidate's timed assessments into an explainable
> career recommendation. The design has three layers: a server-authoritative assessment engine that
> scores objectively and maps results onto a structured skill catalogue; a deterministic, versioned
> algorithm that compares measured skills against career requirements; and an optional AI layer that
> writes the narrative but never produces a number. Four roles are separated by a server-side
> permission matrix, and every number on screen is aggregated from real MongoDB data."

---

## 2. Architecture questions

**Q. Why is it MERN?**
MongoDB's flexible documents suit nested assessment structures (options, per-skill results), while
Mongoose gives schema validation and indexes — the two things an assessment system cannot do without.
React handles the many role-specific screens without page reloads.

**Q. Why separate controllers from services?**
The scoring and matching logic is the part worth testing and explaining. Keeping it in pure service
functions means it can be unit-tested without HTTP, and controllers stay thin HTTP adapters. It also
means a future mobile client or CLI could reuse the same services.

**Q. Walk me through a request.**
Middleware in order: helmet → CORS → body parsing → request logging → rate limit → CSRF →
authentication (loads the user fresh from the database) → permission check → Zod validation →
controller → service → MongoDB.

**Q. Why reload the user on every request?**
So a role change or deactivation takes effect immediately, rather than when the JWT happens to
expire. It costs one indexed lookup and closes a real revocation gap.

**Q. How does this scale?**
Multiple API instances work today — sessions are stateless and the one-live-attempt invariant is
enforced by a partial unique index rather than process memory. The sweep job is idempotent via an
atomic claim, so it is safe as a singleton. Caching is deliberately absent until profiling shows a
need.

---

## 3. Assessment engine

**Q. How is cheating via the timer prevented?**
`expiresAt` is computed and stored on the server at attempt start. The browser countdown is only a
display, and it is anchored to the `serverTime` the API returns so a changed device clock cannot buy
time. Every save and submit re-checks `expiresAt`, and a background sweep finalises anything past its
deadline even if every browser closes.

**Q. What if the candidate refreshes?**
`POST /attempts` returns the **existing** live attempt rather than creating a new one. Answer
documents are seeded at creation, so a refresh restores exactly the same slots and the same timer. A
partial unique index enforces this in the database too.

**Q. Can an attempt be submitted twice?**
The attempt is claimed with an atomic `findOneAndUpdate({ status: 'in_progress' })`. A second submit
finds nothing to claim and returns the existing result unchanged. Test AS-13 verifies this even after
the stored answers are modified directly in the database.

**Q. What happens to a malformed question?**
It is flagged and **excluded**, never guessed at. The test-validation rule requires an MCQ to have at
least two options, a matching answer key and positive marks, or a preference item to have a declared
dimension. The reduced denominator is reported as `scorableMarks` so the UI never implies 100 % meant
full coverage.

**Q. How are personality items scored?**
Not as right or wrong. Each response contributes points to a declared working-preference dimension;
points are aggregated and mapped onto 0–100 where 50 means "no preference expressed". They are
labelled as indicative preferences everywhere and never as personality types or diagnoses.

**Q. What stops an admin editing a question that has already been used?**
The API refuses changes to the answer key, options, skill mappings or marks of an item that has
appeared in a recorded attempt — that would silently alter historical results. Deactivate it and
create a replacement instead.

---

## 4. Scoring

**Q. How does the skill profile accumulate?**
Evidence-weighted mean:

```
newLevel = (oldLevel × oldEvidence + observation × newEvidence)
           / (oldEvidence + newEvidence)
```

so one short test never erases a well-evidenced result, and a later assessment always moves the level
towards the new observation. Every update writes an immutable revision snapshot.

**Q. Walk me through the compatibility algorithm.**
Six documented steps:

1. **Evidence damping** — `confidence = evidence / (evidence + 2)`, `effective = measured × (0.7 + 0.3 × confidence)`.
2. **Ratio** — `min(1, effective / requiredLevel)`.
3. **Weighted fit with a coverage penalty** — `skillFit = Σ(w × ratio) / Σw × (0.40 + 0.60 × dataCoverage)`.
4. **Aptitude fit** — weighted mean over the dimensions the career declares.
5. **Preference fit** — same idea, for declared preference dimensions.
6. **Final** — `100 × (0.70·skillFit + 0.20·aptitude + 0.10·preference)`, re-normalised if a component
   has no data.

**Q. How do you stop missing data being read as low ability?**
Two mechanisms. The coverage penalty is **bounded** — full coverage weight is only 60 %, so an
unmeasured requirement can never destroy a score. And unmeasured requirements are reported with
`state: 'unmeasured'`, listed separately as gaps from weaknesses, and explicitly labelled "not yet
measured". The report says "reported as unknown, not as weaknesses".

**Q. Is the algorithm reproducible?**
Yes — it is deterministic, side-effect free and versioned (`compatibility-v1.0.0`). Test CA-03 feeds
identical input twice and asserts an identical score *and* identical evidence. The scoring version is
stored on every report.

**Q. What if a candidate has done nothing?**
`completedAssessments < 1` or `dataCoverage < 0.15` flags the result as insufficient evidence, the
score is zero, and the summary says so. The dashboard shows an explicit empty state rather than
placeholder numbers.

---

## 5. AI integration

**Q. Why not just let the AI pick the career?**
Because a language model cannot be audited or reproduced. Scores must be explainable and repeatable,
and a model cannot guarantee that. So the model writes the *prose*; the algorithm decides the *numbers*.

**Q. What stops the AI inventing a career or a statistic?**
Five layers: the model receives only pre-computed evidence and explicit instructions; the response is
schema-validated with Zod; career references are allow-listed against the ranked result set — in the
provider wrapper **and again** in the report service; a narrative with no surviving reference is
discarded entirely; and its text is stored in separate fields so it cannot touch the deterministic
results. Test RG-03 injects fabricated slugs and asserts they are gone and scoring is unaffected.

**Q. What if there is no API key?**
The system is fully functional. Reports generate from deterministic templates, and the UI labels them
**"Deterministic"** with an explicit explanation. It never claims an AI call happened when it did not.
That is the configuration the demo normally runs in.

**Q. How do you know which provider produced a report?**
Every report stores `aiProviderUsed`, `aiFailureReason` and `aiLatencyMs`, and the report page states
it in plain language.

**Q. How do you stop the AI running forever?**
`AbortController` timeout (30 s default), max output tokens, and report generation is rate limited to
6 per minute. Transport failures are mapped to typed errors, never unhandled exceptions.

---

## 6. Security

**Q. How is the session secured?**
JWT in an `HttpOnly` cookie — JavaScript cannot read it, which removes token exfiltration via XSS
entirely. `SameSite=Lax`, `Secure` in production. Double-submit CSRF on every state-changing request.
`tokenVersion` invalidates all sessions on role change, deactivation or password change.

**Q. How is RBAC enforced?**
A single permission matrix in `config/constants.ts`. Every protected route declares
`requirePermission(...)`. Ownership is re-checked inside controllers and inside the queries
themselves — a counsellor's student query filters on `assignedCounsellor === own id`, so the
restriction is in the database call, not in the interface.

**Q. What if someone edits a request body?**
Zod validates body, query and params, and the **parsed value replaces** the raw request part, so
controllers only ever see whitelisted, coerced data. No user-supplied object is ever used as a query
filter. Mongoose `strictQuery` is on.

*(If asked about `sanitizeFilter`: I deliberately disabled it — it strips legitimate operators from
trusted internal queries such as the expiry sweep. Protection comes from the fact that no
user-supplied object ever reaches a filter.)*

**Q. How do you protect candidate data?**
Ownership checks on every candidate-scoped query. Another candidate's attempt returns 404, their
report 403. Management is refused individual candidate records outright at the controller, not merely
filtered from a list.

**Q. What gets logged?**
Security and administrative events only. Metadata passes a fixed key allow-list of primitive values,
so raw answers, passwords and tokens cannot be stored even by accident. The HTTP logger records
method, path, status and duration — never bodies, headers or cookies. The application logger redacts
password/token/key fields.

**Q. What's your biggest security gap?**
No MFA. Also: no automated secret rotation, no data-retention job, no encryption at rest beyond the
database default, and audit logs that are not tamper-evident. All are listed in the security
document rather than glossed over.

---

## 7. Data model

**Q. Why thirteen collections rather than one?**
Separation of concerns. Answers are separate from attempts so a 200-question attempt does not carry a
200-element embedded array. Reports are snapshots so history survives later assessments. Master data
(skills, careers) is separate so it can be edited without touching results.

**Q. Why store `skillCode` inside a career requirement as well as the ObjectId?**
Denormalisation for readability and for historical durability. A report generated today stays
readable even if the skill is later renamed, without a join.

**Q. How do you prevent duplicate live attempts?**
A partial unique index on `{ candidate, assessment }` where `status: 'in_progress'`. The database
enforces it even under concurrency, not just the application.

**Q. How do you stop documents growing without limit?**
Per-skill history is capped at the last 20 entries. All list endpoints paginate.

**Q. Is the seed script safe to re-run?**
Yes. Everything upserts on a stable natural key — skill code, career slug, question text, assessment
title, user email — so re-running never duplicates and never touches candidate data. `--reset` wipes
application collections first.

---

## 8. Testing

**Q. How do you test this?**
118 automated tests with Vitest and Supertest against a **real** MongoDB database, plus 73
end-to-end checks against a running server. Business-logic coverage: compatibility 97 %, recommendation
94 %, attempt lifecycle 92 %, scoring 91 %, AI transport ~90 %.

**Q. Why a real database rather than mocks?**
Mocking Mongoose would hide exactly the bugs most likely to matter — indexes, validation, partial
unique constraints, query semantics. A dedicated test database is dropped between suites so
development data is untouched.

**Q. What's the weakest test area?**
Analytics aggregation (33 %). It is verified through the smoke test and by reading real dashboard
responses, but has no dedicated unit tests. I would fix that first with more time.

**Q. Any bugs the tests caught?**
Yes — seven, documented in the test results. The most interesting: `answeredCount` was always zero
because `isAnswered` was never set; and the unknown-career filter originally lived only in the AI
provider wrapper, so replacing the generator would have let a fabricated career through. That one I
moved into the report service as defence in depth.

---

## 9. Honest limitations

Say these plainly — it strengthens the rest of your answers.

| Limitation | Why it exists |
|---|---|
| Assessment bank and career catalogue are **sample data** | Created for this project; illustrative, not validated against industry standards or a population |
| The algorithm is **not psychometrically validated** | No correlation with real career outcomes is claimed or tested |
| **No proctoring** | A timed test over an unsupervised network is not a supervised exam |
| **No MFA** | Single-factor sessions |
| **No retention or deletion job** | Inactive accounts persist until an administrator acts |
| Audit logs are **not tamper-evident** | An administrator with DB access could alter them |
| **Single database, no cache** | Adequate for an institution, not for very large scale |
| AI narrative needs a **paid key** | Deterministic mode is fully functional and is the default demo |
| **English only** | The catalogue and prompts are English-only |
| Only Chromium-based browser verified | No cross-browser matrix testing |

---

## 10. Ethics — expect these

**Q. Is a low compatibility score a judgement on the candidate?**
No. It means the career definition lists competencies this candidate has not demonstrated *in this
system yet*. Most of those are learnable, which is exactly what the roadmap addresses. Unmeasured
requirements are reported as **unknown**, never as weaknesses, and the coverage penalty is bounded so
they cannot dominate a score.

**Q. Could the personality results discriminate?**
That is precisely why they are not treated as a personality assessment. They report **working
preferences**, they have **no pass mark**, they never gate access to a career, and every screen labels
them as indicative preferences. No protected characteristic — gender, age, religion, caste,
disability — is used anywhere in matching. Matching uses evidence-based competencies and defensible
preferences only.

**Q. Does the system promise employment?**
No. Every report carries an explicit disclaimer stating that a compatibility score is not a
probability of getting a job, a hiring prediction or a guarantee of success. No placement-success or
prediction-accuracy figure appears anywhere.

**Q. Who can see my data?**
The candidate, their assigned counsellor and administrators. Management gets aggregate counts only
and is refused individual records at the API. Access is enforced server-side on every request —
hiding a button is a convenience, not the protection.

---

## 11. Demonstration script (5 minutes)

1. **Landing page** — explain the four workspaces and the disclaimer.
2. **Sign in as candidate** — dashboard with real data, not placeholders.
3. **Assessments → Aptitude Test → refresh mid-test** — *the timer does not reset*. This is the single
   most convincing moment.
4. **Submit → result** — score, per-skill analysis, answer review.
5. **Career Reports → Generate** — ranked careers, expand one for the evidence table.
6. **Show the "Deterministic" notice** — explain that no AI key is configured and that nothing was
   faked.
7. **Sign in as management → open a student record** — shows *403*. Then show aggregate analytics.
8. **Sign in as admin → Audit log** — show real events from the session just performed.

---

## 12. Questions to ask the panel

Asking these shows you understand the design:

- *How would you validate the algorithm against real career outcomes before deploying it?*
- *How would you add MFA without breaking existing sessions?*
- *What would you change if assessments had to be invigilated?*
- *How would you scale the question bank to 10,000 items with per-candidate randomisation?*
- *How would you make audit logs tamper-evident?*
