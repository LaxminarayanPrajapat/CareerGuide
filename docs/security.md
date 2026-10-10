# Security, Privacy and Responsible AI

Assessment responses, skill profiles and career reports are treated as **sensitive records**. This
document states what is implemented, and — equally important — what is not claimed.

---

## 1. Threat model

| Threat | Control implemented |
|---|---|
| Credential stuffing / brute force | bcrypt (cost 12) · 10 attempts / 15 min on credential endpoints · account lock after 8 failures · uniform failure message (no user enumeration) |
| Session theft via XSS | Session token in an `HttpOnly` cookie — JavaScript cannot read it · `SameSite=Lax` · no token in `localStorage` |
| CSRF | Double-submit cookie: readable `cgs_csrf` echoed in `X-CSRF-Token`; enforced on every state-changing request that carries a session |
| Privilege escalation | Permission matrix on the server · fresh user load per request · ownership re-check in controllers and queries |
| Insecure direct object reference | Every candidate-scoped query filters on the owner id; a foreign id returns 404/403, never data |
| NoSQL injection | Zod validation replaces `req.body`/`req.query` with parsed, whitelisted values; all queries use operators on known fields |
| Stored XSS | React escapes by default; the printable report HTML is server-rendered with explicit escaping of every interpolation |
| Mass assignment | Explicit allow-listed fields in every update; no spread of the raw request body into a document |
| Server-side timer tampering | `expiresAt` is recorded server-side and re-checked on every save and submit; a sweep finalises regardless of the client |
| Score tampering | Scoring happens server-side from the stored answer key; the browser never computes a score |
| AI hallucinated careers / figures | Model output cannot affect scores or rankings · Zod validation · career references allow-listed twice · prompt forbids invented figures |
| Secret leakage | Secrets only in environment variables · logger redacts password/token/key fields · never returned by any endpoint |
| Log tampering | API logs record method/path/status only — never bodies, headers or cookies |
| Information disclosure in error messages | Central handler; production responses never include stack traces or internal text |

---

## 2. Implemented controls

### Authentication
- Passwords hashed with **bcrypt**, cost factor 12, per-password salt. Plaintext is never stored or logged.
- `passwordHash`, `resetTokenHash` and `resetTokenExpiresAt` use `select: false` — they are not even loaded unless explicitly requested.
- Password reset tokens are SHA-256 hashed at rest, single-use, and expire in 30 minutes.
- `tokenVersion` invalidates every existing session on role change, deactivation or password change.
- 15-minute account lock after 8 consecutive failures.

### Authorisation
- One permission matrix in `server/src/config/constants.ts`; the admin UI renders from the API so it cannot drift.
- Every protected route declares `requirePermission(...)`.
- Ownership is re-checked inside controllers — a counsellor reaching a student not assigned to them gets 403.
- Management has **no write permission anywhere**; individual candidate records are refused outright.

### Input & output
- Zod validates body, query and params, and the parsed value *replaces* the request part.
- Mongoose `strictQuery` is on. (`sanitizeFilter` is deliberately off: it would strip legitimate
  operators from trusted internal queries such as the expiry sweep. Protection comes from the fact
  that no user-supplied object is ever used as a filter.)
- JSON body limited to 256 KB.
- All user-facing HTML is escaped, including the printable report.

### Transport & headers
- `helmet` sets CSP, HSTS-adjacent headers, `X-Content-Type-Options`, `X-Frame-Options` and friends.
- `X-Powered-By` disabled.
- CORS restricted to `CLIENT_ORIGIN`; any other origin is rejected.
- Cookies: `HttpOnly`, `SameSite=Lax`, `Secure` in production, `trust proxy` configured for correct
  client IPs behind a load balancer.

### Rate limiting
| Scope | Limit |
|---|---|
| General API | 300 / 15 min per account (or IP when anonymous) |
| Credential endpoints | 10 / 15 min |
| Report generation | 6 / min |

### Audit logging
Sign-in/out, failed logins, locks, role and status changes, password resets, attempt start/submit,
report generation/view/download, roadmap updates, master-data writes and settings changes.
`metadata` passes through a **fixed key allow-list of primitive values** — raw answers, passwords and
tokens cannot be written even by mistake.

### Secrets
- `JWT_SECRET`, `MONGODB_URI`, AI keys and mail credentials exist only in `server/.env` (gitignored).
- `SystemSetting` refuses to store secrets; `GET /settings` reports only *whether* a key is configured.
- `.env.example` files contain placeholders only. No real key is committed anywhere in this repository.

---

## 3. Responsible AI

### What the AI may do
Write the narrative *wording* for a report, given evidence that the deterministic engine already
computed.

### What the AI may never do
- Produce or alter a score, rank or gap.
- Introduce a career that is not in the ranked result set.
- Invent a percentage, skill level or statistic.
- Decide access, permissions or visibility.
- Describe the candidate in diagnostic, clinical or personality-type language.
- Promise an employment outcome.

### How this is enforced (not merely requested)
1. The AI is called **after** scoring, and its text is stored in separate fields from the
   deterministic results.
2. The provider receives only pre-computed, structured evidence.
3. The response is parsed defensively (handles fenced or embedded JSON) and validated with Zod.
4. Career references are allow-listed against the ranked set — in the provider wrapper **and again**
   in the report service, so the invariant holds even if the provider layer is replaced.
5. A narrative with no surviving reference is discarded entirely, and the reason recorded.
6. Any failure, timeout or invalid response yields a fully-labelled **deterministic** report. The
   product never claims an AI request succeeded when it did not.

### Timeouts and limits
Provider calls use an explicit `AbortController` timeout (default 30 s), a max output token budget,
and the report endpoint is rate limited.

---

## 4. Limits of the advice — stated plainly

- A **career compatibility score** compares measured competencies with a career definition. It is
  **not** a probability of employment, a hiring prediction, or a guarantee of success.
- Working-preference results are **indicative preferences only**. They are not psychological,
  clinical or diagnostic findings and must not be used as such.
- **No psychometric validity, prediction accuracy or placement-success figure is claimed anywhere.**
- Recommendations depend on assessment quality, catalogue accuracy and the documented scoring
  assumptions. Scoring rules are versioned so results remain reproducible and auditable.
- Recommendations do not **exclude** a career because a skill has not yet been learned — an
  unmeasured requirement is reported as *unknown* and carries a bounded penalty, not a disqualification.
- No protected personal characteristic is used to narrow career options. Matching uses
  evidence-based competencies and defensible working preferences only.
- No comparison against other candidates, percentile rank or cohort ranking is produced.
- The career catalogue is **illustrative sample data** for academic demonstration. It is not an
  exhaustive or ranked list of careers and should be reviewed against current industry guidance
  before real use.

---

## 5. Privacy posture

| Data | Stored | Who can read it |
|---|---|---|
| Account details, password hash | yes | the owner; admins (never the hash) |
| Academic profile | optional | the owner, their counsellor, admins |
| Assessment responses | yes | the owner, their counsellor, admins |
| Skill profile | yes (derived) | the owner, their counsellor, admins |
| Career report | yes (derived) | the owner, their counsellor, admins |
| Audit events | yes (safe metadata only) | admins |
| Individual candidate records | — | **never** exposed to management |

Management reporting returns aggregate counts only, and the API says so in a `privacyNotice` field on
every institutional response.

---

## 6. Known gaps

Stated rather than hidden:

- **No MFA.** Single-factor session authentication.
- **No automated secret rotation** — it is a manual operational task.
- **No data-retention or automatic deletion job.** Inactive accounts persist until an administrator
  deactivates them.
- **No encryption at rest** beyond what the database engine provides by default.
- **Audit logs are not tamper-evident** — an administrator with database access could modify them.
- **No proctoring.** A timed test over an unsupervised network is not equivalent to a supervised
  examination; the system does not claim otherwise.
- **Password policy is strength-based, not breach-list-based** (no Have I Been Pwned check).

---

## 7. Before deploying anywhere public

1. **Delete every seeded demo account**:
   ```javascript
   db.users.deleteMany({ email: /@careerguide\.local$/ })
   ```
2. Generate a unique `JWT_SECRET` (≥ 32 chars) and a strong `MONGODB_URI`.
3. Set `NODE_ENV=production`, `COOKIE_SECURE=true`, and restrict `CLIENT_ORIGIN`.
4. Serve over HTTPS only.
5. Restrict MongoDB network access and enable authentication.
6. Configure backups **and verify a restore**.
7. Review the career catalogue and the AI prompt against your institution's policy.
8. Set up log aggregation and alert on `severity: critical` audit entries.
