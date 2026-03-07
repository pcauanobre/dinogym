# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DinoGym is a gym progress tracking web app for members to log workouts, track PRs, manage routines, and view monthly analytics. Frontend SPA in React + Vite + MUI + Recharts, powered by Supabase (Auth, Database, RLS). Deploy via Vercel.

## Commands

```bash
npm run dev              # dev server at localhost:5173
npm run build            # production build
npm run preview          # preview production build locally
```

## Environment Variables

**`.env`**
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Architecture

### Auth Flow
- Users sign up/login with **email + password** via Supabase Auth
- Supabase manages JWT tokens automatically (stored in localStorage under `sb-*-auth-token`)
- On signup, trigger auto-creates profile + RPC creates 150+ default exercises and default routine
- Admin role stored in `profiles.role` column

### Database (Supabase PostgreSQL)

Schema defined in `supabase/schema.sql`. Tables use snake_case, frontend converts to camelCase via compatibility layer.

```
profiles         → id (= auth.uid), name, email, role (ADMIN|MEMBER), photo_base64
machines         → id, user_id, name, category, current_pr, is_favorite, photo_base64
workout_sessions → id, user_id, date, started_at, finished_at, duration, day_rating(1-5), nutrition(1-5), finished
workout_entries  → id, session_id, machine_id, weight, sets, reps, hit_pr, previous_pr, notes, sets_data(JSONB), comment
routine_days     → user_id + day_of_week (unique), label; has many routine_exercises
routine_exercises → routine_day_id, machine_id, sets, reps, reps_max, sort_order
```

**RLS:** All tables have Row Level Security. Users can only CRUD their own data. Routine sharing uses a SECURITY DEFINER RPC function.

**RPC Functions:**
- `create_default_exercises()` — inserts 150+ exercises across 10 categories
- `create_default_routine()` — creates Pull/Push/Leg1/Upper/Leg2 routine
- `get_routine_by_email(target_email)` — returns another user's routine as JSONB

**PR Detection:** Done in the frontend compatibility layer (`src/utils/api.js`). When adding a workout entry, if `weight > machine.currentPR`, sets `hitPR=true` and updates `machine.current_pr`.

### Frontend

- `src/App.jsx` — React Router with protected routes; routes: `/login`, `/register`, `/app`, `/app/treino`, `/app/maquinas`, `/app/rotina`, `/app/relatorio`
- `src/main.jsx` — MUI dark theme with green accent (`#22c55e`), BrowserRouter
- `src/supabaseClient.js` — Supabase client initialization
- `src/utils/authStorage.js` — token helpers wrapping Supabase session checks
- `src/utils/api.js` — compatibility layer mapping REST-style paths to Supabase queries (camelCase ↔ snake_case conversion)
- `src/utils/offlineQueue.js` — offline session queue + `syncPending()` sync logic
- `src/utils/simDay.js` — day-of-week simulation for testing routine carousel (`dg_simday_offset` in localStorage)
- `src/constants/categories.js` — 10 exercise categories with gradient/color mappings (source of truth for category display)

**Offline-first:** Heavy localStorage caching. Key storage keys: `dg_machines`, `dg_all_routine`, `dg_routine_{dow}`, `dg_user`, `dg_offline_session`, `dg_pending_sessions`. When offline, workouts are queued and synced when connection returns.

**No state management library** — component state + localStorage handles all caching/sync. No TypeScript.

**UI language:** All labels, messages, and user-facing text are in **Portuguese**.

**SwipeNav** (`src/components/SwipeNav.jsx`) wraps the protected app and enables left/right swipe between tabs (disabled on elements with `data-noSwipe`).

### Branches
- `main` — production (auto-deploy)
- `dev` — active development; merge to `main` when ready to deploy
