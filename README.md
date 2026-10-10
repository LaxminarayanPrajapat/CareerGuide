# AI Career Path & Skill Recommendation System

An academic MERN project that turns a candidate's timed assessments into an **explainable,
evidence-based career recommendation** — with a deterministic scoring engine, an optional AI
narrative layer, and server-enforced role-based access control.

> **Read this first.** A *career compatibility score* in this system compares what the candidate has
> **measured** against what a career **requires**. It is **not** a probability of getting a job, a
> hiring prediction, or a psychometric score. Working-preference results are **not** psychological
> diagnoses. See [`docs/privacy-and-disclaimer.md`](docs/privacy-and-disclaimer.md).

---

## What it does

1. **Five assessment categories** — aptitude, logical reasoning, technical knowledge, domain
   knowledge, and an indicative working-preference instrument.
2. **Server-authoritative test engine** — deadlines are recorded server-side, survive a browser
   refresh, and auto-finalise. Scoring happens on the server; the browser never computes a score.
3. **Structured skill profile** — every scored question maps to one or more catalogue skills. Levels
   accumulate as an *evidence-weighted mean*, so one short test never erases a well-evidenced result.
4. **Transparent career matching** — a documented, versioned algorithm produces a compatibility
   score plus a per-requirement evidence table. Unmeasured requirements are reported as **unknown**,
   never as weaknesses.
5. **AI that explains, never decides** — if a provider is configured, it receives only the
   already-computed evidence and writes the wording. Output is schema-validated and its career
   references are allow-listed. With no key configured, the system still produces full reports from
   deterministic templates and says so plainly.
6. **Four role workspaces** — candidate, counsellor, management (read-only) and administrator,
   with a permission matrix enforced on the API rather than in the UI.

---

## Quick start

```bash
# 1. Install everything (npm workspaces)
npm install

# 2. Configure the backend
cp server/.env.example server/.env
#    -> set MONGODB_URI and a long random JWT_SECRET

# 3. Load the sample catalogue, assessments and demo accounts
npm run seed

# 4. Run the API and the web app together
npm run dev
```

- Web app: <http://localhost:5173>
- API: <http://localhost:5000/api/v1>
- Health check: <http://localhost:5000/health>

Full setup instructions, including MongoDB installation, are in
[`docs/setup-guide.md`](docs/setup-guide.md).

### Development demo accounts

Created by `npm run seed`. **Development only — never deploy these.**

| Role | Email | Password |
|---|---|---|
| Administrator | `admin@careerguide.local` | `Admin@12345` |
| Counsellor | `counsellor@careerguide.local` | `Counsellor@12345` |
| Management | `management@careerguide.local` | `Management@12345` |
| Candidate | `student@careerguide.local` | `Student@12345` |
| Candidate | `diya.patel@careerguide.local` | `Student@12345` |
| Candidate | `rohan.mehta@careerguide.local` | `Student@12345` |
| Candidate | `ananya.nair@careerguide.local` | `Student@12345` |

---

## Repository layout

```text
ai-career-path-skill-recommendation-system/
├── client/                     React 18 + Vite + TypeScript + Tailwind + Recharts
│   └── src/
│       ├── components/        common/ · layout/  (design system + shells)
│       ├── features/auth/     AuthContext + route guards
│       ├── lib/               typed API client, formatters
│       ├── pages/             public/ · student/ · counsellor/ · management/ · admin/
│       └── types/             shared API types
├── server/                    Express + Mongoose + Zod (TypeScript, ESM)
│   └── src/
│       ├── config/            env, database, permission matrix
│       ├── controllers/       HTTP handling only
│       ├── middleware/        auth, RBAC, CSRF, validation, errors, rate limits
│       ├── models/            Mongoose schemas
│       ├── routes/            /api/v1
│       ├── schemas/           Zod request validation
│       ├── services/
│       │   ├── assessments/   attempt lifecycle, scoring, skill profiles
│       │   ├── careers/       compatibility scoring algorithm
│       │   ├── recommendations/ report + roadmap orchestration
│       │   ├── ai/            provider abstraction, validation, fallback
│       │   └── analytics/     role-scoped aggregations
│       ├── jobs/              attempt-expiry sweep
│       ├── seed/              repeatable sample data
│       └── tests/             Vitest + Supertest
├── docs/                      architecture, API, database, testing, deployment, viva
├── scripts/smoke-test.ts       end-to-end check against a running server
└── package.json                npm workspaces
```

---

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start API (tsx watch) and Vite dev server together |
| `npm run seed` | Idempotently upsert sample data (safe to re-run) |
| `npm run seed:reset` | Wipe application collections, then seed |
| `npm test` | Run the Vitest + Supertest suite |
| `npm run typecheck` | Typecheck server and client |
| `npm run build` | Production build of both applications |
| `npm start` | Run the compiled server from `server/dist` |
| `npx tsx scripts/smoke-test.ts` | 73 end-to-end checks against a running server |

---

## Configuration

Only the backend reads secrets. The frontend has no secrets — see
[`client/.env.example`](client/.env.example).

| Variable | Required | Purpose |
|---|---|---|
| `MONGODB_URI` | yes | MongoDB connection string |
| `JWT_SECRET` | yes | Signs session tokens (≥32 chars in production) |
| `CLIENT_ORIGIN` | yes | Comma-separated CORS allow-list |
| `PORT` | no | API port (default `5000`) |
| `COOKIE_SECURE` | no | Set `true` behind HTTPS in production |
| `AI_PROVIDER` | no | `none` \| `gemini` \| `openai` |
| `GEMINI_API_KEY` / `OPENAI_API_KEY` | no | Enable the AI narrative layer |
| `MAIL_ENABLED` | no | Enables the real password-reset email workflow |

Startup validates configuration and fails fast with an actionable message rather than erroring later
at runtime.

---

## Documentation

| Document | Contents |
|---|---|
| [`docs/setup-guide.md`](docs/setup-guide.md) | Prerequisites, local setup, troubleshooting |
| [`docs/architecture.md`](docs/architecture.md) | Layering, request lifecycle, scoring algorithm, AI pipeline |
| [`docs/api-documentation.md`](docs/api-documentation.md) | Every endpoint, permission, status codes |
| [`docs/database-design.md`](docs/database-design.md) | Collections, indexes, relationships, backup/restore |
| [`docs/security.md`](docs/security.md) | Threat model and implemented controls |
| [`docs/privacy-and-disclaimer.md`](docs/privacy-and-disclaimer.md) | Privacy posture and responsible-AI limits |
| [`docs/test-plan.md`](docs/test-plan.md) | Test strategy, cases, coverage matrix |
| [`docs/test-results.md`](docs/test-results.md) | Actual recorded results |
| [`docs/user-manual.md`](docs/user-manual.md) | Screen-by-screen guide for all four roles |
| [`docs/deployment-guide.md`](docs/deployment-guide.md) | Production deployment and hardening |
| [`docs/viva-preparation.md`](docs/viva-preparation.md) | Architecture, scoring, AI, security, limitations |
| [`docs/diagrams/`](docs/diagrams/) | Mermaid architecture, ER and workflow diagrams |

---

## Scope

Deliberately **out of scope**: job-portal integration, payment processing, video proctoring,
biometric authentication, and any hiring or placement functionality.

## Licence

MIT — academic project.
