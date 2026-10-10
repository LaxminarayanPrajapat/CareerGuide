# Setup Guide

Local installation and verification of the AI Career Path & Skill Recommendation System.

---

## 1. Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Node.js | ≥ 20.19 (tested on 24.11) | `node --version` |
| npm | ≥ 10 (tested on 11.6) | ships with Node |
| MongoDB | ≥ 6 (tested on 8.x) | local, Docker, or Atlas |

MongoDB is the only external service. Everything else is optional.

```bash
node --version
npm --version
mongod --version     # or: mongosh --eval "db.runCommand({ping:1})"
```

---

## 2. Install

```bash
git clone <repository-url>
cd ai-career-path-skill-recommendation-system
npm install
```

This is an npm workspaces monorepo, so a single `npm install` at the root installs the `server` and
`client` workspaces.

---

## 3. Configure the backend

```bash
cp server/.env.example server/.env
```

Edit `server/.env`:

```dotenv
NODE_ENV=development
PORT=5000

MONGODB_URI=mongodb://127.0.0.1:27017/career_guide

CLIENT_ORIGIN=http://localhost:5173

# Generate a real one:  node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
JWT_SECRET=<64+ random characters>

# AI narrative layer — leave as-is to run fully without any AI provider
AI_PROVIDER=none
GEMINI_API_KEY=
OPENAI_API_KEY=
```

### Configuration rules

- `MONGODB_URI` and `JWT_SECRET` are **required**. Startup fails with a clear message if either is
  missing, and `JWT_SECRET` shorter than 32 characters is rejected in production.
- `CLIENT_ORIGIN` is a comma-separated allow-list. A request from any other origin is refused by
  CORS middleware.
- **Never** place `GEMINI_API_KEY` or `OPENAI_API_KEY` in `client/.env`. They are read only by the
  server and are never returned by any endpoint.
- `AI_PROVIDER=none` is a fully supported mode: reports generate from deterministic templates.

---

## 4. Start MongoDB

**Local service (already running on Windows):**

```powershell
Get-Service -Name *mongo*
Get-Service -Name MongoDB | Start-Service
```

**Docker:**

```bash
docker run -d --name career-guide-mongo -p 27017:27017 mongo:7
```

**MongoDB Atlas:** paste the SRV string into `MONGODB_URI` and allow-list your IP.

Verify connectivity:

```bash
mongosh "mongodb://127.0.0.1:27017/career_guide" --eval "db.runCommand({ping:1})"
# { ok: 1 }
```

---

## 5. Seed sample data

```bash
npm run seed
```

Creates (idempotently — safe to run repeatedly):

- 5 assessment categories
- 28 skills
- 16 career definitions with required competencies and weights
- 67 questions (53 scored MCQs + 14 preference statements)
- 6 test sets (5 published, 1 draft)
- 5 system settings
- 7 development demo accounts

To wipe application data first:

```bash
npm run seed:reset
```

---

## 6. Run the application

```bash
npm run dev
```

Starts both:

| Service | URL |
|---|---|
| Web app | <http://localhost:5173> |
| API | <http://localhost:5000/api/v1> |
| Health | <http://localhost:5000/health> |

Vite proxies `/api` and `/health` to the backend, so the browser stays on a single origin and session
cookies work without relaxing CORS.

### Run separately (two terminals)

```bash
npm run dev:server     # tsx watch on :5000
npm run dev:client     # vite on :5173
```

---

## 7. Verify the installation

**Health check**

```bash
curl http://localhost:5000/health
```

```json
{ "success": true, "data": { "status": "ok", "database": "connected" } }
```

**End-to-end smoke test** — exercises auth, the full attempt lifecycle, scoring, skill profiles,
report generation, RBAC and CSRF against the running server:

```bash
npx tsx scripts/smoke-test.ts
#  73 passed, 0 failed
```

**Automated test suite**

```bash
npm test
#  Test Files  3 passed (3)
#       Tests  97 passed (97)
```

The suite uses a separate `career_guide_test` database and drops it between suites, so your
development data is untouched.

**Production builds**

```bash
npm run typecheck   # server + client, no errors
npm run build       # server -> server/dist, client -> client/dist
```

---

## 8. Sign in

Open <http://localhost:5173> and use one of the development accounts from the README, e.g.

```
student@careerguide.local / Student@12345
```

A quick tour for a candidate:

1. **Assessments** → pick *Sample Aptitude Test* → *Start*
2. Answer every question (the timer keeps running if you refresh — try it)
3. *Submit assessment* → you immediately see your score, per-skill analysis and an answer review
4. **Career Reports** → *Generate report* → ranked careers with an evidence table per career
5. **Learning Roadmaps** → open a roadmap and mark an item in progress

---

## 9. Troubleshooting

### `npm` fails with "Dynamic require of child_process is not supported"

A VS Code debug preload in `NODE_OPTIONS` is breaking npm. Clear it for the session:

```powershell
$env:NODE_OPTIONS = ""; npm install
```

On macOS/Linux: `unset NODE_OPTIONS`.

### `MongooseServerSelectionError`

MongoDB is not running or the URI is wrong.

```bash
mongosh "mongodb://127.0.0.1:27017/career_guide" --eval "db.runCommand({ping:1})"
```

### `Invalid server configuration: JWT_SECRET is required`

`server/.env` was not copied or was not loaded. Confirm the file exists and that the API was started
from the `server` workspace (`npm run dev:server`).

### Login succeeds but every request returns 401

The session cookie was not stored. Check that:

- you are on `http://localhost:5173` (same origin as the API via the Vite proxy);
- `CLIENT_ORIGIN` includes exactly that origin;
- your browser is not blocking third-party cookies.

Confirm the cookie is `HttpOnly` and `SameSite=Lax`.

### "Authentication required" immediately after sign-in

The API restarted and `JWT_SECRET` changed, or `server/.env` was edited. Sign in again.

### Port already in use

```powershell
Get-NetTCPConnection -LocalPort 5000 -State Listen | Select-Object OwningProcess
Stop-Process -Id <pid> -Force
```

### The AI narrative never appears

This is expected with `AI_PROVIDER=none`. The report still generates; the interface labels it
**"Deterministic"** and shows a `Deterministic report` notice. To enable AI, set `AI_PROVIDER` and
the matching key, then restart the API. Check status at `GET /api/v1/settings`.

### A test set will not publish

The server refuses to publish when the question pool has fewer active questions than the configured
question count, or when items lack a valid answer key. Fix the pool or deactivate the broken items
in **Question bank**.

---

## 10. Resetting everything

```bash
# Stop the servers (Ctrl+C in each terminal, or:)
Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
  Where-Object { $_.CommandLine -like "*CareerGuide*" } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force }

# Wipe and reseed
npm run seed:reset

# Drop the test database
mongosh "mongodb://127.0.0.1:27017/career_guide_test" --eval "db.dropDatabase()"
```

---

## 11. Next steps

- Understand the system: [`architecture.md`](architecture.md)
- Understand the scoring: the "Career compatibility algorithm" section of [`architecture.md`](architecture.md)
- Understand the API: [`api-documentation.md`](api-documentation.md)
- Understand the data: [`database-design.md`](database-design.md)
- Prepare for the viva: [`viva-preparation.md`](viva-preparation.md)
