# AI-Powered Tax Platform — Prototype

A clickable prototype of a client/CPA tax platform, built for the "Designing an AI-Powered Tax
Platform From Scratch" case study. Covers all 10 challenges from the brief.

**Live demo:** https://ai-powered-tax-platform-790425128523.us-south1.run.app

## Running it locally

Two ways to run this — pick whichever fits what you're doing.

### Option A — dev servers (for making changes)

Two servers, two terminal tabs, live-reloading on both sides.

**Backend (Flask + SQLAlchemy + SQLite):**
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python seed.py      # builds tax_platform.db with fake clients, returns, documents, tasks, messages
python app.py        # runs on http://localhost:5050
```

**Frontend (Vite + React + TypeScript + Tailwind):**
```bash
cd frontend
npm install
npm run dev           # runs on http://localhost:5173, proxies /api/* to Flask on :5050
```

Open `http://localhost:5173`.

### Option B — the production container (matches what's actually deployed)

```bash
docker build -t greengrowth-tax-platform .
docker run -p 5050:5050 greengrowth-tax-platform
```

Open `http://localhost:5050`. This runs the exact multi-stage image (Node builds the frontend,
then a Python stage runs Flask behind gunicorn and serves the built frontend as static files) that
ships to Cloud Run, seeding fresh demo data on every container start.

### What you'll see either way

There's no real login — opening the app lands on a "Choose an account" screen (styled like a real
multi-account switcher, not a labeled dev control) where you pick which of the 8 seeded people to
browse as. The choice is remembered for that browser tab only (not shared across tabs, so you can
open two tabs as two different roles side by side to compare views), until you click the
GreenGrowth logo to go back and switch accounts. That's `sessionStorage`, not `localStorage`, on
purpose — so a brand-new tab never silently inherits whatever account another tab is using.

Whenever backend code changes, restart Flask. Whenever `seed.py` changes, re-run `python seed.py`
before restarting (it rebuilds the database from scratch).

## Deployment

Containerized with a single multi-stage `Dockerfile` at the repo root: one stage builds the
frontend with Node, the other runs the Flask API behind gunicorn, which serves the built frontend
as static files from that same process — one deployable unit, no separate frontend/backend hosting
or CORS configuration to maintain in production.

Deployed on **Google Cloud Run**, connected directly to this GitHub repo for continuous deployment
— every push to `main` triggers a Cloud Build that rebuilds the Dockerfile and rolls out a new
revision automatically, with no manual redeploy step.

Worth knowing about the live deployment specifically:
- **The database resets on every cold start.** The container re-runs `python seed.py` each time it
  boots, since the SQLite file lives in the container's writable layer and doesn't persist across
  restarts, redeploys, or Cloud Run scaling to zero — this keeps the live demo always in a
  known-good state rather than stale or half-edited, but it also means nothing typed into the live
  app (field corrections, completed tasks, sent messages) survives a redeploy or a cold wake-up.
- **Cloud Run scales to zero when idle**, so the first request after a few minutes of no traffic
  can take a couple of seconds to wake back up.

## Demo accounts

| Name | Role | What to look at |
|---|---|---|
| Sarah Chen | Client | Mid-onboarding — has documents/fields, two active message threads, one remaining task |
| Jordan Lee | Client | Genuinely brand-new — zero documents, tests the first-time onboarding flow end to end |
| David Nguyen | Client | Filed — tests the "you're done" celebration state and a closing conversation thread |
| Marcus Webb | Business Owner | Owns Webb Consulting — the large (~150-field) return with every field state represented |
| Priya Patel | Preparer | Also has her own personal return (blocked) — the dual-role case; her dashboard shows a "Top Priority" hero card |
| James O'Brien | Reviewer | Owns Lena Ortiz's return and reviews Priya's blocked return |
| Dana Fisher | Admin | Sees the firm-wide Dashboard and Returns list (manager view) — grouped by owner, with a workload overview sidebar |
| Alex Kim | Seasonal Staff | Owns Jordan Lee's return, plus a data-entry task on Webb Consulting |

## What's real vs. simulated

**Real:**
- The relational schema (SQLAlchemy models: clients, users, returns, documents, fields, tasks,
  messages, status history) and the REST API built on top of it
- Role-based data scoping, enforced server-side — a client's browser never receives another
  client's data, and a preparer only receives their assigned returns plus their own personal one
  if they have one
- The dashboard's prioritization logic (`score_task` in `app.py`) — priority weight + due-date
  proximity + blocked status, computed server-side, not a hardcoded order
- Inline field editing, the "correct the AI" flow, task actions (complete/snooze/reassign), and
  messaging all make real `PATCH`/`POST` requests that persist to the database and are reflected
  immediately — none of it is faked in local state only
- Once a field is verified, its confidence score is actually cleared server-side, not just hidden
- The "Need Attention" stat and per-field "Needs Approval" badge are computed from real
  low-confidence field data, not decorative
- Deep-linking from the Dashboard straight to the exact field a task is about (resolved
  server-side), and from a Returns Workspace field back out to "why is this ranked here"

**Simulated (per the brief's explicit instruction to fake this):**
- AI confidence scores, explanations, and corrections (`backend/ai_simulate.py`) — deterministic
  rules based on a field's shape (has a source doc? was a calculation applied? was it forced
  low-confidence for the demo?), not a real model
- Source documents — stylized mock pages with labeled, positioned boxes populated from the
  return's own real field data, not actual scans or OCR
- Authentication — the "Choose an account" screen and role switcher stand in for real login
- The client onboarding upload flow — a real interactive choose-file → uploading → error →
  success sequence, but nothing is actually stored; the "file" is never read
- "New return" button on the Returns list — visibly present but intentionally not wired up

## Where each challenge lives

| # | Challenge | Where |
|---|---|---|
| 01 | Source Document Traceability | Return Workspace → Fields tab → click any field → Document Viewer panel on the right; also the Documents tab for browsing source files directly |
| 02 | Client & CPA Collaboration | Return Workspace → Messages tab — try Webb Consulting for multiple parallel threads |
| 03 | Where to Start | Log in as Jordan Lee (client) — real upload flow, progress bar, time/purpose per task, "Why we need this" explainer |
| 04 | Getting Lost Between Parts of the App | Breadcrumbs, URL-driven tab/field/thread state (survives refresh), clickable related tasks/messages, Dashboard deep-links straight to the exact field |
| 05 | Role-Aware Experiences | Role switcher (top-right, same position for every role) — try Priya Patel for the dual-role case |
| 06 | Return Status & Progress | Status bar at the top of any return — click "History" to expand the status timeline |
| 07 | An Actionable Dashboard | Dashboard nav link (staff roles only) — try Priya (individual, with a "Top Priority" hero card) vs. Dana (manager view, grouped + workload sidebar) |
| 08 | Clickable vs. Editable | Field list legend + state filter chips; editable fields are genuinely typeable, not just visually tagged; low-confidence fields show an explicit "Needs Approval" badge |
| 09 | Complexity Made Navigable | Webb Consulting's return — category summary strip, state filter chips, sort control, and a standalone Documents browser, all tested against ~150 real fields |
| 10 | Trustworthy AI | Click any confidence badge — explanation, evidence, uncertainty, an explicit recommended action, and a correction/mark-reviewed flow |

## Design decisions worth knowing about

- **One consolidated Return Workspace, not ten separate screens.** Challenges 01, 04, 06, 08, 09,
  and 10 are all facets of the same core screen — reviewing a return. Building them as one
  integrated experience is closer to how this would actually ship, and it's what a real reviewer
  moves through.
- **Flask, not FastAPI.** The job this case study is for maintains a Python/Flask/Postgres
  monolith — matching that stack was deliberate, since the backend here is intentionally
  throwaway and stack-fit mattered more than framework features.
- **SQLite instead of Postgres**, through SQLAlchemy models designed the way a Postgres schema
  would be — swapping the connection string is the only change needed to point this at real
  Postgres.
- **Active Record, not a repository layer.** Routes call SQLAlchemy's `Model.query` directly
  rather than going through a repository/service abstraction — a conscious trade-off given the
  backend is deliberately disposable, not an oversight.
- **URL as the source of truth for navigation state.** Which tab, which field, which message
  thread is selected all live in the URL (`?tab=fields&field=12`), not component state — so
  refreshing, sharing a link, or hitting browser back/forward actually preserves what you were
  looking at, instead of only feeling that way.
- **Status is a 5-stage stepper, not raw status strings**, with "blocked" as an overlay rather
  than a 6th stage, since a blocker can happen at any point in the process. A fabricated but
  plausible history timeline (`StatusEvent`) answers "what's already happened," which the stepper
  alone can't.
- **A preparer with a personal return** (Priya Patel) sees it mixed into her own returns list
  rather than through a separate "act as client" identity switch — a simpler, more honest
  resolution of that edge case than building a full second UI mode for one account.
- **The Dashboard and Returns list are deliberately styled differently**, even though they're
  both "list of things at scale" screens — Returns is a browsable catalog (plain cards, no
  ordering implied); Dashboard is a ranked queue (numbered rank, urgency-colored left borders,
  filled alert-style stat cards, a "Top Priority" hero card), because they're answering different
  questions ("what exists" vs. "what should I do right now").
- **Webb Consulting's ~150 bulk-generated fields deliberately include every affordance state**
  (locked, verified, editable, needs-approval, and normal AI-generated) in realistic proportions,
  not just uniform high-confidence output — otherwise the one return built for scale couldn't
  demonstrate the full Challenge 08 system on its own.

## Known limitations

- Business-owner and client roles currently only ever have one return each in the seed data; the
  client landing page assumes a single return per client and doesn't handle multiple.
- Returns list and Dashboard filters/search/sort reset if you navigate away and back — they're
  not persisted in the URL the way the Return Workspace's tab/field/thread state is.
- No automated tests — this is a prototype built to be clicked through, not shipped.
