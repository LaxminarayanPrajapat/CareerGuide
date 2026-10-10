# User Manual

Screen-by-screen guide for all four roles.

---

## Contents

1. [Getting started](#1-getting-started)
2. [Candidate](#2-candidate)
3. [Counsellor](#3-counsellor)
4. [Management](#4-management)
5. [Administrator](#5-administrator)
6. [Reading your results](#6-reading-your-results)

---

## 1. Getting started

### Create an account

**Register** → enter your name, email and a password that meets the on-screen checklist (8+
characters with an uppercase letter, a lowercase letter, a digit and a special character) → confirm
the password → tick the AI-advice disclaimer → **Create account**.

Academic details (institution, department, year, batch, roll number) are optional but improve
batch-level reporting and help your counsellor.

> Staff accounts are **not** self-service. An administrator creates them.

### Sign in

**Sign in** → email and password. After eight failed attempts the account locks for 15 minutes.

### The interface

- **Narrow screen** — tap the menu icon (top left) to open the navigation drawer.
- **Wide screen** — the sidebar is always visible.
- **Profile menu** (top right, your initials) → profile, settings, sign out.
- **Toasts** (bottom right) confirm actions. Errors stay until dismissed.

---

## 2. Candidate

### Dashboard

Your landing page after sign-in.

| Card | Meaning |
|---|---|
| **Profile completion** | Fill in academic details to reach 100 % |
| **Assessments completed** | Finished tests, and any currently in progress |
| **Skills measured** | Distinct skills with evidence, plus catalogue coverage |
| **Average objective score** | Mean across completed scored tests (`n/a` before you take one) |
| **Career reports** | 0 or 1, with the most recent report time |

Below: top career recommendations from your latest report, strongest measured skills, a category
performance chart, roadmap progress, recent activity and a **Next steps** list.

> With no completed assessments the dashboard shows an explicit empty state — never placeholder
> numbers.

### Taking an assessment

1. **Assessments** → pick a test set → read the description → **Start**.
2. **Instructions screen** — read the rules and tick the confirmation box.
3. **The attempt screen:**

| Element | Behaviour |
|---|---|
| **Timer** (top right) | Turns amber under 5 minutes, red under 1 minute |
| **Question grid** (right) | Jump to any question; green = answered, amber dot = flagged |
| **Flag** | Mark a question to review later |
| **Answers** | Save automatically as you select them |

- **Refresh the page** — the attempt and the remaining time are preserved. The timer lives on the
  server.
- **If time runs out**, your saved answers are submitted automatically.
- **You cannot submit twice**, and cannot change answers afterwards.

4. **Result screen** — your score, per-skill analysis, and an expandable answer review with
   explanations.

If items were flagged as broken by the system, a warning explains it and the score is shown against
the items that were actually scorable.

### Your history

**History** → every completed attempt with score, questions answered, time taken and submission
status. A chart shows your recent objective scores.

**Skill progression** only appears when a skill has been measured more than once — with a single
observation there is no trend, and the system says so rather than drawing a misleading line.

### Career reports

1. **Career Reports** → **Generate report**.
2. The report contains:

| Section | What it shows |
|---|---|
| **How this report was produced** | Whether AI was used, or that it is deterministic |
| **Assessment summary** | Assessments used, skills measured, catalogue coverage |
| **Measured skill levels** | Every skill with its score and evidence |
| **Strongest / lowest skills** | Ranked lists from measured data only |
| **Not yet measured** | Skills reported as *unknown*, explicitly not as weaknesses |
| **Working preferences** | Indicative preference dimensions, 50 = neutral |
| **Recommended careers** | Ranked list with a compatibility score |
| **Evidence per career** | Expand any career for a requirement-by-requirement table |

3. **Print / save as PDF** opens a clean printable version. Use your browser's *Save as PDF*.

> An existing report is **reused** if your skill profile has not changed. Use *Regenerate* to force a
> fresh one.

### Skill profile and compatibility

**Skill profile & career compatibility** → live view of the deterministic scores.

- Filter by minimum score.
- Expand any career to see the full requirement table: required level, effective measured level,
  weight, and a written note explaining that requirement's contribution.
- Requirements marked *not measured* are clearly separated.

### Learning roadmaps

**Learning Roadmaps** → one roadmap per recommended career, with items grouped into beginner,
intermediate and advanced stages.

Each item has a completion criterion. Update an item yourself:

| Action | Status |
|---|---|
| **Start** | in progress |
| **Mark complete** | completed |
| **Reset** | back to not started |

Progress updates as you act. **Nothing is ever marked complete automatically.**

### Your profile

**Profile** → name, phone, academic details, career objective, portfolio and LinkedIn URLs. Change
your password under *Change password* — this signs out your other sessions.

### Career catalogue

**Career Catalogue** → browse every career with its required competencies, target levels, weights and
suggested learning stages. Expand a row to see the full requirement table.

---

## 3. Counsellor

### Dashboard

Shows only candidates **assigned to you**. Summary cards, category performance, the most common top
career match across your students, and a *Students who may need guidance* list (fewer than two
completed assessments).

### My students

**My students** → search by name or email → **View record** to open a candidate's dashboard: their
completed assessments, average score, profile completion, top career matches, full skill profile,
recent activity and career reports (read-only).

> Candidates not assigned to you are not listed and cannot be opened, even by guessing an ID.

### Question bank

**Question bank** → the shared pool of items.

- **Filter** by category, difficulty, or free-text search.
- **Expand** a row to see options, the correct answer, explanation and mapped skills.
- **New question** → create an item.

**Multiple choice:** text, category, topic, difficulty, marks, options, tick the correct one, and
select which skills it measures.

**Preference scale:** select *Preference scale*, pick the dimension, set the scale bounds, and give
each option its points (−2 … +2). These items are never marked right or wrong.

**Edit protection:** an item already used in a recorded attempt cannot have its answer key, options,
skill mappings or marks changed — that would silently alter historical results. Deactivate it and
create a replacement instead.

### Test sets

**Test sets** → create and manage tests.

**New test set** requires a title, description, candidate instructions, category, question pool,
questions per attempt, duration, marks per question, passing percentage and attempt limit.

**Draft** tests are invisible to candidates. **Publish** makes a test available.

> The system refuses to publish when the pool has fewer active questions than the configured count, or
> when items are not scorable.

### Batch analytics

**Batch analytics** → filter by batch and department. Aggregate performance by category, career
interest distribution, and students needing attention. **Export CSV** downloads the same figures.

---

## 4. Management

Your workspace is **read-only**. There is no way to create, edit or delete anything.

### Institutional dashboard

Registered students, assessment completion rate, average score, active career definitions, completion
by category, batch distribution and career-interest distribution. Filter by batch and department.

### Aggregate analytics

Monthly completion trend, category averages and CSV export.

### Aggregate exports

Shows exactly the metrics included in the CSV, plus a statement of what is **included** and what is
**excluded** (names, emails, individual scores, answers, reports and skill profiles).

> Management cannot open an individual candidate's record. Attempting to returns *403* — this is a
> server-side restriction, not a hidden link.

---

## 5. Administrator

### Admin dashboard

User, question, test-set, skill and career counts; attempt lifecycle; users by role; recent audit
activity; and a warning when security events have been recorded in the last 7 days.

### User management

| Action | How |
|---|---|
| **Create account** | *New account* → details, role, temporary password |
| **Change role** | Use the role dropdown in the table |
| **Deactivate** | *Deactivate* → confirm. All sessions end immediately. |
| **Reactivate** | *Activate* |

Safeguards:

- You cannot deactivate or demote your own account.
- The last active administrator cannot be removed or demoted.
- A candidate with an attempt in progress cannot be deactivated.
- Temporary passwords force a change on first sign-in.

### Question bank

As described for counsellors, plus **delete**. Deletion is refused for any item already used in a
recorded attempt — deactivate instead.

### Test sets, career catalogue, skill catalogue

As described above, with editing. Changes to career required levels and weights affect all **future**
reports; existing reports keep the values and scoring version in force when they were generated.

### Assessment categories

View the five categories with question and attempt counts. Deactivating a category hides it from
navigation; recorded attempts keep their original category.

### System settings

- **AI provider** — shows which providers are configured and *whether* a key is present. **Keys are
  never displayed.** To enable AI, edit `server/.env` and restart the API.
- **Application configuration** — site name, assessment notice, default pass percentage, explanation
  display, minimum data coverage. Changes are audited.

> Secrets — API keys, JWT secret, database credentials — are not editable here. They live in
> environment variables.

### Audit logs

Security and administrative events with filters for category, severity and outcome: sign-ins, failed
logins, locks, role and status changes, password resets, attempt start/submit, report
generation/view/download and roadmap updates.

> Metadata is filtered to safe primitive fields. Passwords, tokens and raw answer payloads are never
> stored.

### System analytics

Platform counts, users by role and the attempt lifecycle (total / completed / in progress).

---

## 6. Reading your results

### Objective score

A percentage of the **scorable** items in that specific test. It is not compared to other candidates,
and no percentile or rank is produced.

`marksObtained / scorableMarks` is shown explicitly. If broken items were excluded, the interface
says so and shows both figures.

### Working preferences

Indicative preferences about the kind of work you tend to enjoy. **Not** personality types, **not**
abilities, **not** diagnoses, and they never restrict your options. A score of 50 means no preference
expressed.

### Career compatibility score (0–100)

Compares what the system has **measured** for you with what each career **requires**.

| Label | Meaning |
|---|---|
| **Confidence: good** | 70 %+ of that role's requirements measured |
| **Confidence: moderate** | 40–70 % |
| **Confidence: low** | under 40 % |
| **Limited evidence** | Too little data to treat the score as reliable |
| **Not measured** | No assessment covers this requirement — *unknown*, not a weakness |

A lower score usually means the career lists competencies you have not demonstrated **in this system
yet**, which is information about a learning plan rather than a verdict.

### What a score is not

- Not a probability of getting a job
- Not a hiring prediction
- Not a guarantee of success
- Not a validated psychometric measure

Discuss your report with a qualified counsellor before making decisions.
