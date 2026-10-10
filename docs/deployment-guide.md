# Deployment Guide

Deploying the AI Career Path &amp; Skill Recommendation System to a real environment.

---

## 1. Deployment options

| Target | Frontend | Backend | Database |
|---|---|---|---|
| **Single VPS** (recommended for an academic demo) | Nginx serving `client/dist` | Node process behind Nginx | Local MongoDB |
| **Containerised** | Nginx container | Node container | Mongo container / Atlas |
| **Managed** | Vercel / Netlify / Cloudflare Pages | Render / Railway / Fly.io | MongoDB Atlas |

The single-VPS option is simplest and is what this project assumes below.

---

## 2. Pre-deployment checklist

> **Do every item in this section before the application is reachable from a network.**

- [ ] Every seeded demo account deleted
- [ ] New `JWT_SECRET` generated (≥ 32 random characters)
- [ ] Production `MONGODB_URI` with authentication enabled
- [ ] `NODE_ENV=production`, `COOKIE_SECURE=true`
- [ ] `CLIENT_ORIGIN` set to the exact frontend origin (no wildcard)
- [ ] HTTPS certificate installed and auto-renewing
- [ ] MongoDB network access restricted (no `0.0.0.0/0`)
- [ ] Backups configured **and a restore tested**
- [ ] Career catalogue reviewed against current guidance
- [ ] `npm audit` reviewed
- [ ] Log aggregation and alerting configured

```javascript
// mongosh — remove development accounts BEFORE going live
db.users.deleteMany({ email: /@careerguide\.local$/ })
db.users.find({}, { email: 1, role: 1, isActive: 1 })
```

If no administrator remains, start the server once with a `BOOTSTRAP_ADMIN_PASSWORD` set — it creates
the first admin **only** when the collection is empty, then prints a warning to change it.

---

## 3. Environment variables (production)

```dotenv
NODE_ENV=production
PORT=5000
LOG_LEVEL=info

MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/career_guide?retryWrites=true&w=majority
MONGODB_DB_NAME=career_guide

CLIENT_ORIGIN=https://career.example.edu

JWT_SECRET=<64+ random characters>
JWT_EXPIRES_IN=2h
COOKIE_SECURE=true
SESSION_TTL_MINUTES=120

# Only if the AI narrative is wanted
AI_PROVIDER=gemini
GEMINI_API_KEY=<server-side secret>
GEMINI_MODEL=gemini-2.0-flash

# Optional password-reset email
MAIL_ENABLED=true
MAIL_HOST=smtp.example.edu
MAIL_PORT=587
MAIL_SECURE=true
MAIL_USER=<smtp user>
MAIL_PASSWORD=<smtp secret>
MAIL_FROM="CareerGuide <no-reply@career.example.edu>"

ATTEMPT_SWEEP_INTERVAL_MS=60000
```

Keep this file at mode `600` on the server. Never commit it.

---

## 4. Build

```bash
npm ci
npm run typecheck
npm run test
npm run build
```

Produces:

- `server/dist/` — compiled Node application
- `client/dist/` — static frontend bundle

`server/dist` needs the environment variables at runtime, not at build time.

---

## 5. Single-VPS deployment

### 5.1 System packages

```bash
sudo apt update
sudo apt install -y nginx
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
```

### 5.2 Application user

```bash
sudo adduser --system --group --home /opt/career-guide careerguide
sudo mkdir -p /opt/career-guide
sudo chown careerguide:careerguide /opt/career-guide
```

Copy the repository to `/opt/career-guide` and build there as that user.

### 5.3 Backend as a service (systemd)

`/etc/systemd/system/career-guide-api.service`:

```ini
[Unit]
Description=AI Career Guide API
After=network.target mongod.service

[Service]
Type=simple
User=careerguide
Group=careerguide
WorkingDirectory=/opt/career-guide/server
EnvironmentFile=/opt/career-guide/server/.env
ExecStart=/usr/bin/node dist/server.js
Restart=always
RestartSec=5

# Hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/career-guide

StandardOutput=journal
StandardError=journal
SyslogIdentifier=career-guide-api

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now career-guide-api
sudo systemctl status career-guide-api
sudo journalctl -u career-guide-api -f
```

### 5.4 Nginx

```nginx
server {
    listen 80;
    server_name career.example.edu;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name career.example.edu;

    ssl_certificate     /etc/letsencrypt/live/career.example.edu/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/career.example.edu/privkey.pem;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-Frame-Options DENY always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;

    root /opt/career-guide/client/dist;
    index index.html;

    client_max_body_size 2m;

    # API
    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }

    location /health {
        proxy_pass http://127.0.0.1:5000/health;
        proxy_set_header Host $host;
    }

    # Hashed assets are immutable
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }

    # SPA history fallback
    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache";
    }
}
```

> **Why one origin matters:** serving the SPA and the API from the same host means the session cookie
> is first-party, so `SameSite=Lax` works and no CORS relaxation is needed. Do not split them across
> subdomains without revisiting the cookie and CORS settings.

```bash
sudo nginx -t
sudo systemctl reload nginx
```

### 5.5 Verify

```bash
curl https://career.example.edu/health
# {"success":true,"data":{"status":"ok","database":"connected",...}}
```

Then sign in through the browser and complete one assessment end to end.

---

## 6. Managed hosting

### Frontend (Vercel / Netlify / Cloudflare Pages)

| Setting | Value |
|---|---|
| Build command | `npm run build --workspace client` |
| Output directory | `client/dist` |
| Node version | 20 or 22 |
| Environment | `VITE_API_BASE_URL=https://api.career.example.edu` |

Rewrite all unmatched routes to `/index.html` (SPA history fallback).

> **Note:** with the API on a different domain the browser will make cross-origin requests and the
> session cookie becomes third-party. Either use a shared parent domain with `SameSite=None; Secure`,
> or — preferably — put the API behind the same origin via a proxy as in §5.4.

### Backend (Render / Railway / Fly.io)

| Setting | Value |
|---|---|
| Root directory | `server` |
| Build command | `npm ci && npm run build` |
| Start command | `node dist/server.js` |
| Health check | `/health` |
| Environment | the full variable set from §3 |

Set `COOKIE_SECURE=true` and `CLIENT_ORIGIN` to the exact frontend origin.

### Database

MongoDB Atlas M0 is sufficient for a demonstration. Enable:
- database authentication (always),
- IP allow-list (never `0.0.0.0/0` in production),
- automated backups with a tested restore.

---

## 7. Backup and restore

```bash
# Logical backup
mongodump --uri="$MONGODB_URI" --db career_guide --gzip --archive=backup-$(date +%F).gz

# Restore
mongorestore --uri="$MONGODB_URI" --gzip --archive=backup-2026-01-15.gz --db career_guide \
  --drop
```

Recommended schedule: daily logical backups retained 14 days, plus Atlas continuous backup or a
replica-set snapshot policy. **Test a restore into a scratch database at least once a quarter** — an
unverified backup is not a backup.

---

## 8. Monitoring

| Signal | Where | Action |
|---|---|---|
| API down | `/health` non-200 | systemd restarts; alert externally |
| Database disconnected | `/health` → `database: disconnected` | check MongoDB service and network |
| Repeated security events | `GET /api/v1/audit-logs?severity=critical` | investigate |
| Disk growth (audit logs, backups) | host monitoring | prune or archive |
| AI failures | report response `aiFailureReason` | check key, quota and provider status |

Minimal external check:

```bash
* * * * * curl -fsS https://career.example.edu/health > /dev/null || \
          curl -fsS -X POST https://hooks.slack.com/services/XXX
```

---

## 9. Operational routines

| Routine | Frequency |
|---|---|
| Review critical audit entries | Weekly |
| Review accounts needing deactivation | Monthly |
| Verify a backup restore | Quarterly |
| Review the career catalogue against current guidance | Each semester |
| `npm outdated` / dependency updates | Monthly |
| Rotate `JWT_SECRET` (invalidates all sessions — do out of hours) | Yearly, or on suspected compromise |

---

## 10. Scaling notes

The current design is single-instance by intent. If you outgrow it:

1. **Multiple API instances** — safe today. Sessions are stateless JWTs and the live-attempt invariant
   is enforced by a database index, not process memory.
2. **The sweep job** must then be single-instance (or made idempotent across workers, which it
   already is via the atomic attempt claim).
3. **MongoDB Atlas** handles the database tier.
4. **Caching** is unnecessary until measured — add it only after profiling shows a specific hot path.

---

## 11. Rollback

```bash
# 1. Stop the service
sudo systemctl stop career-guide-api

# 2. Restore the previous build
cd /opt/career-guide && git checkout <previous-tag> && npm ci && npm run build

# 3. Restart
sudo systemctl start career-guide-api

# 4. If a data migration ran, restore the database from before the deployment
mongorestore --uri="$MONGODB_URI" --gzip --archive=backup-<pre-deploy>.gz --db career_guide --drop
```

Keep the previous build artefact and a pre-deployment database backup until the release is confirmed
healthy.

---

## 12. Known deployment caveats

- **No MFA** — single-factor session authentication only.
- **No automated data-retention job** — inactive accounts persist until an administrator deactivates them.
- **Audit logs are not tamper-evident** — an administrator with database access could alter them.
- **Single database, no cache** — adequate for an institution, not for a very large one.
- **The AI layer needs a paid provider key.** With `AI_PROVIDER=none` the system is fully functional
  using deterministic explanations, which is the recommended demo configuration.
