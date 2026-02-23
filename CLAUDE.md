# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DinoGym is a gym progress tracking web app for members to log workouts, track PRs, manage routines, and view monthly analytics. Backend REST API in Node.js/Express + Prisma + PostgreSQL (Neon). Frontend SPA in React + Vite + MUI + Recharts. Deploy via Render (backend) and Vercel (frontend).

## Commands

### Backend (`cd backend`)

```bash
npm run dev              # start with nodemon (auto-reload)
npx prisma db push       # sync schema.prisma to the database
npx prisma studio        # visual DB browser at localhost:5555
npx prisma generate      # regenerate Prisma client (after fresh install)
node prisma/seed.js      # seed admin user + 3 weeks of example workout data
```

### Frontend (`cd frontend`)

```bash
npm run dev              # dev server at localhost:5173
npm run build            # production build
npm run preview          # preview production build locally
```

## Environment Variables

**`backend/.env`**
```
DATABASE_URL="postgresql://user:pass@host/dinogym?sslmode=require"
JWT_SECRET="secret"
ADMIN_EMAIL="admin@dinogym.com"
ADMIN_PASSWORD="password"
ADMIN_NAME="Admin"
CORS_ORIGINS="http://localhost:5173"
PORT=3001
```

**`frontend/.env`**
```
VITE_API_URL=http://localhost:3001
```

## Architecture

### Auth Flow
- Admin logs in with **email + password**
- Members log in with **CPF + password** (after first-access activation)
- JWT tokens valid for 7 days, stored in `localStorage` (persistent) or `sessionStorage` (session-only)
- First-access flow: admin registers member (name + CPF only) → member sets own password via `/auth/primeiro-acesso/activate` → backend auto-creates 150+ default exercises for that member

### Backend

- Entry: `src/index.js` — Express + cors + morgan, routes mounted at `/auth`, `/users`, `/machines`, `/sessions`, `/routine`; health check at `/health`
- Auth middleware: `src/middleware/auth.js` — `requireAuth()` and `requireRole(role)` for JWT + RBAC
- Single Prisma client in `src/lib/prisma.js` — includes P1017 reconnection logic for Neon's connection timeout
- Async route errors handled by `src/utils/asyncHandler.js` (`wrap()` wrapper)
- Default exercises list (150+ across 10 categories) in `src/utils/defaultExercises.js`

**Key route files and their responsibilities:**
- `auth.routes.js` — login, first-access verify + activate
- `machines.routes.js` — exercise CRUD, favorites, photo upload, PR tracking
- `sessions.routes.js` — session lifecycle, workout entries, history, monthly report, per-exercise progress
- `routine.routes.js` — weekly routine read/write per day-of-week
- `users.routes.js` — profile photo update

**PR Detection:** When adding a workout entry, if `weight > machine.currentPR`, the backend sets `hitPR=true` on the entry and updates `machine.currentPR`. The previous PR is stored in `entry.previousPR`.

### Database Models (Prisma)

```
User         → id, name, email, cpf, passwordHash, role (ADMIN|MEMBER), firstAccessDone, photoBase64
Machine      → id, userId, name, category, currentPR, isFavorite, photoBase64
WorkoutSession → id, userId, date, startedAt, finishedAt, duration, dayRating(1-5), nutrition(1-5), finished
WorkoutEntry → id, sessionId, machineId, weight, sets, reps, hitPR, previousPR, notes, setsData(JSON), comment
RoutineDay   → userId + dayOfWeek (unique), label; has many RoutineExercises
RoutineExercise → routineDayId, machineId, sets, reps, repsMax, sortOrder
```

### Frontend

- `src/App.jsx` — React Router with protected routes; routes: `/login`, `/app`, `/app/treino`, `/app/maquinas`, `/app/rotina`, `/app/relatorio`
- `src/main.jsx` — MUI dark theme with green accent (`#22c55e`), BrowserRouter
- `src/utils/authStorage.js` — token read/write helpers abstracting localStorage vs sessionStorage
- `src/utils/api.js` — Axios instance with auto JWT injection, 10s timeout, base URL from `VITE_API_URL`
- `src/utils/offlineQueue.js` — offline session queue + `syncPending()` sync logic
- `src/utils/simDay.js` — day-of-week simulation for testing routine carousel (`dg_simday_offset` in localStorage)
- `src/constants/categories.js` — 10 exercise categories with gradient/color mappings (source of truth for category display)
- Vite proxy: `/api` → `localhost:3001` in development

**Offline-first:** Heavy localStorage caching. Key storage keys: `dg_machines`, `dg_all_routine`, `dg_routine_{dow}`, `dg_user`, `dg_offline_session`, `dg_pending_sessions`. When offline, workouts are queued and synced when connection returns.

**No state management library** — component state + localStorage handles all caching/sync. No TypeScript.

**UI language:** All labels, messages, and user-facing text are in **Portuguese**.

**SwipeNav** (`src/components/SwipeNav.jsx`) wraps the protected app and enables left/right swipe between tabs (disabled on elements with `data-noSwipe`).

### Branches
- `main` — production (auto-deploy)
- `dev` — active development; merge to `main` when ready to deploy
