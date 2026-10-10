# Diagrams

Mermaid sources for the system architecture, data model and workflows. All render natively on GitHub
and in VS Code with the Markdown Preview Mermaid Support extension.

---

## 1. System architecture

```mermaid
flowchart TB
    subgraph Client["Client — React + Vite + TypeScript + Tailwind"]
        direction TB
        UI["Role-specific pages"]
        COMP["Reusable components<br/>cards · tables · dialogs · charts"]
        STATE["AuthContext<br/>session + permissions"]
        API["lib/api.ts<br/>typed client, CSRF header"]
        UI --> COMP --> API
        STATE --> UI
    end

    subgraph Server["Server — Express + TypeScript"]
        direction TB
        MW["Middleware<br/>helmet · CORS · rate limit<br/>CSRF · auth · permission · Zod"]
        CTRL["Controllers — HTTP only"]
        SVC["Domain services"]
        MODEL["Mongoose models"]
        MW --> CTRL --> SVC --> MODEL
    end

    DB[("MongoDB<br/>13 collections")]

    subgraph Optional["Optional external"]
        GEM["Gemini API"]
        OAI["OpenAI API"]
    end

    API -->|"HTTPS<br/>httpOnly cookie"| MW
    MODEL --> DB
    SVC -.->|"only when configured"| GEM
    SVC -.->|"only when configured"| OAI
```

---

## 2. Role workspaces and permission boundaries

```mermaid
flowchart LR
    V["Visitor"] --> PUB["Public pages<br/>landing · how it works<br/>categories · privacy"]
    PUB --> REG["Register / Sign in"]

    REG --> ST["Candidate"]
    REG --> CO["Counsellor"]
    REG --> MG["Management"]
    REG --> AD["Administrator"]

    ST --> ST1["Assessments · Attempts<br/>Reports · Roadmaps<br/>Profile · Compatibility"]
    CO --> CO1["Assigned students<br/>Question bank · Test sets<br/>Batch analytics"]
    MG --> MG1["Aggregate analytics<br/>Career interest<br/>Exports — READ ONLY"]
    AD --> AD1["Users · Master data<br/>Settings · AI config<br/>Audit logs · System analytics"]

    style MG1 fill:#fff7ed,stroke:#ea580c
    style AD1 fill:#eef2ff,stroke:#4338ca
    style ST1 fill:#ecfdf5,stroke:#059669
    style CO1 fill:#f0fdfa,stroke:#0d9488
```

**All four boundaries are enforced by the API**, not by hiding navigation. A request without the
required permission returns `403` regardless of what the interface shows.

---

## 3. Assessment attempt lifecycle

```mermaid
stateDiagram-v2
    [*] --> Available : published + in window

    Available --> in_progress : candidate starts<br/>server records startedAt + expiresAt

    note right of in_progress
        Answers saved incrementally
        Question/option order frozen
        Refresh returns THIS attempt
        Client may NOT extend the deadline
    end note

    in_progress --> in_progress : PUT /answers<br/>rejected after the deadline (410)
    in_progress --> submitted : POST /submit<br/>atomic claim
    in_progress --> auto_submitted : deadline passes<br/>client request OR server sweep

    submitted --> Scored : scores + per-skill results stored
    auto_submitted --> Scored : same scoring path

    note right of Scored
        Attempt is now immutable.
        Further edits return 409.
        Skill profile updated with an
        evidence-weighted merge.
        A revision snapshot is written.
    end note

    Scored --> [*]

    note left of Available
        Attempt limit per test set
        Enforced server-side.
    end note
```

---

## 4. Scoring and recommendation pipeline

```mermaid
flowchart TB
    subgraph Assess["Assessment"]
        Q["Questions<br/>answer key stored server-side"] --> SC["AttemptScorer"]
        R["Responses"] --> SC
        SC --> V{"Test-validation rule"}
        V -->|invalid| X["Flagged + excluded<br/>no answer invented"]
        V -->|valid MCQ| M["Marks from answer key"]
        V -->|preference| P["Points to a dimension"]
    end

    M --> SP["Spread across mapped skills"]
    P --> AG["Aggregate preferences"]
    SP --> PROF["Skill profile<br/>evidence-weighted merge"]
    AG --> REP

    PROF --> REP["Candidate skill profile"]

    subgraph Match["Deterministic matching — compatibility-v1.0.0"]
        REP --> D1["1. Evidence damping<br/>effective = measured × (0.7 + 0.3·confidence)"]
        D1 --> D2["2. Ratio<br/>min(1, effective / required)"]
        D2 --> D3["3. Weighted fit<br/>× (0.40 + 0.60 · dataCoverage)"]
        D3 --> D4["4/5. Aptitude + preference fit<br/>re-normalised if absent"]
        D4 --> D5["6. Final score 0–100<br/>+ confidence + evidence table"]
    end

    D5 --> AI{"AI configured?"}
    AI -->|no| T["Deterministic templates"]
    AI -->|yes| G["Provider call<br/>timeout + Zod validation<br/>career allow-list"]
    G -->|invalid| T
    G -->|valid| N["AI narrative<br/>stored separately"]
    T --> OUT["CareerReport<br/>+ LearningRoadmaps"]
    N --> OUT
```

---

## 5. AI safety pipeline

```mermaid
flowchart TB
    EV["Structured evidence<br/>skills, gaps, coverage,<br/>ranked career slugs"] --> CALL["Provider call<br/>AbortController timeout<br/>max output tokens"]

    CALL --> DEC{"Provider<br/>responded?"}
    DEC -->|"no / timeout /<br/>HTTP error"| FALL["Deterministic template text"]
    DEC -->|yes| PARSE["Defensive JSON parse<br/>handles fenced + embedded JSON"]

    PARSE --> SCHEMA{"Zod schema<br/>valid?"}
    SCHEMA -->|no| FALL
    SCHEMA -->|yes| ALLOW{"All career slugs<br/>in the ranked set?"}

    ALLOW -->|no| STRIP["Strip unknown keys<br/>(provider wrapper AND report service)"]
    ALLOW -->|yes| KEEP

    STRIP --> LEFT{"Any reference<br/>survived?"}
    LEFT -->|no| FALL
    LEFT -->|yes| KEEP["Validated narrative"]

    KEEP --> STORE["Stored in aiNarrative<br/>NEVER alongside the scores"]
    FALL --> STORE2["Report still generated<br/>labelled 'Deterministic'"]
    STORE --> DONE["Candidate report"]
    STORE2 --> DONE

    style FALL fill:#fff7ed,stroke:#ea580c
    style DONE fill:#ecfdf5,stroke:#059669
```

**Invariant:** model output can never produce or alter a number, a rank or a permission decision.

---

## 6. Entity relationship diagram

```mermaid
erDiagram
    USER ||--o{ ATTEMPT : "takes"
    USER ||--o{ CAREER_REPORT : owns
    USER ||--o| CANDIDATE_SKILL_PROFILE : has
    USER ||--o{ SKILL_PROFILE_REVISION : snapshots
    USER ||--o{ QUESTION : authors
    USER ||--o| USER : "assigned counsellor"

    ASSESSMENT ||--o{ ATTEMPT : attempted
    ASSESSMENT }o--o{ QUESTION : "question pool"
    ASSESSMENT_CATEGORY ||--o{ ASSESSMENT : classifies
    ASSESSMENT_CATEGORY ||--o{ QUESTION : classifies

    ATTEMPT ||--o{ ANSWER : contains
    ATTEMPT }o--o{ QUESTION : "randomised order"

    QUESTION }o--o{ SKILL : measures
    SKILL ||--o{ CAREER : "required by"
    SKILL ||--o{ CANDIDATE_SKILL_PROFILE : "measured in"

    CAREER ||--o{ CAREER_REPORT : "recommended in"
    CAREER ||--o{ ROADMAP : "target of"
    CAREER_REPORT ||--o{ ROADMAP : generates

    USER {
        ObjectId _id PK
        string fullName
        string email UK
        string passwordHash "select:false"
        string role "admin|counsellor|management|student"
        bool isActive
        int tokenVersion "session revocation"
        object studentProfile
        ObjectId assignedCounsellor FK
    }

    ATTEMPT {
        ObjectId _id PK
        ObjectId candidate FK
        ObjectId assessment FK
        string status
        date startedAt
        date expiresAt "authoritative"
        array questionOrder
        int marksObtained
        int scorableMarks
        int totalMarks
        int percentage
    }

    ANSWER {
        ObjectId _id PK
        ObjectId attempt FK
        ObjectId question FK
        string selectedOptionId
        int marksAwarded "server only"
        string evaluationStatus
    }

    CANDIDATE_SKILL_PROFILE {
        ObjectId candidate PK
        array measurements
        int revision
        float catalogueCoverage
    }

    CAREER {
        ObjectId _id PK
        string slug UK
        string title UK
        array requiredSkills "skill, requiredLevel, weight"
        bool isActive
    }

    CAREER_REPORT {
        ObjectId _id PK
        string reportNumber UK
        ObjectId candidate FK
        string scoringVersion
        array recommendations
        string aiProviderUsed
        string generationStatus
    }
```

---

## 7. Request authorisation sequence

```mermaid
sequenceDiagram
    autonumber
    participant B as Browser
    participant MW as Middleware
    participant C as Controller
    participant S as Service
    participant DB as MongoDB

    B->>MW: GET /api/v1/reports/CGR-2026-0001<br/>cookie only
    MW->>MW: helmet · CORS · rate limit
    MW->>MW: GET → CSRF not required
    MW->>DB: load user by session sub
    DB-->>MW: user (role, isActive, tokenVersion)
    MW->>MW: tokenVersion matches?<br/>role has reports:read-own?
    MW->>MW: Zod validate params

    alt Not authenticated
        MW-->>B: 401 UNAUTHORIZED
    else Authenticated but not permitted
        MW-->>B: 403 FORBIDDEN
    else Permitted — now check ownership
        MW->>C: validated request
        C->>DB: find report by reportNumber
        DB-->>C: report
        C->>C: report.candidate === user.id ?
        alt Own report
            C->>S: record audit + serialise
            S-->>C: payload
            C-->>B: 200 report
        else Someone else's report
            C-->>B: 403 (never leak that it exists to some IDs)
        end
    end
```

Authorisation is checked **three times** — authentication, permission, ownership — because any one of
them alone is insufficient.

---

## 8. Skill profile evolution

```mermaid
flowchart LR
    A1["Assessment 1<br/>4 items → 75%"] -->|"score 75<br/>evidence 4"| P["Skill profile<br/>level 75<br/>evidence 4"]
    A2["Assessment 2<br/>4 items → 25%"] -->|"score 25<br/>evidence 4"| M["Evidence-weighted merge<br/>(75×4 + 25×4) / 8 = 50"]
    P --> M
    M --> P2["level 50<br/>evidence 8<br/>observations 2"]
    P2 --> H["Revision 2 snapshot<br/>history retained<br/>attempt 1 still queryable"]

    style P2 fill:#ecfdf5,stroke:#059669
    style H fill:#f0fdfa,stroke:#0d9488
```

A single short test never erases a well-evidenced earlier result, and history is never overwritten.

---

## 9. Deployment topology

```mermaid
flowchart TB
    U["Users"] --> CDN["Nginx<br/>:443 TLS<br/>static SPA + API proxy"]
    CDN --> APP["Express API<br/>systemd · :5000<br/>client/dist served statically"]
    APP --> MONGO[("MongoDB<br/>:27017<br/>loopback only")]

    APP -.->|"optional"| AI["Gemini / OpenAI<br/>outbound HTTPS"]

    SCHED["cron: mongodump<br/>daily"] --> BACKUP["Backups<br/>offsite + tested restore"]

    MONGO --> SCHED

    style MONGO fill:#fff7ed,stroke:#ea580c
    style APP fill:#eef2ff,stroke:#4338ca
```

Single-origin serving keeps the session cookie first-party, so `SameSite=Lax` works and no CORS
relaxation is required.
