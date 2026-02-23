# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DinoGym is a gym management web app. Backend REST API in Node.js/Express + Prisma + PostgreSQL (Neon). Frontend SPA in React + Vite + MUI. Deploy via Render (backend) and Vercel (frontend).

## Commands

### Backend (`cd backend`)

```bash
npm run dev              # start with nodemon (auto-reload)
npx prisma db push       # sync schema.prisma to the database
npx prisma studio        # visual DB browser
npx prisma generate      # regenerate Prisma client (after fresh install)
node prisma/seed.js      # seed initial admin user
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
- First-access flow: admin registers member (name + CPF only) → member sets own password via `/auth/primeiro-acesso/activate`

### Backend
- Entry: `src/index.js` — Express + cors + morgan, routes mounted at `/auth`, health check at `/health`
- Auth middleware: `src/middleware/auth.js` — `requireAuth()` and `requireRole(role)` for JWT + RBAC
- Single Prisma client instance in `src/lib/prisma.js`
- User model has `role` (`ADMIN` | `MEMBER`), `cpf`, `passwordHash`, `firstAccessDone`

### Frontend
- `src/App.jsx` — React Router setup with protected routes
- `src/main.jsx` — MUI dark theme with green accent (`#22c55e`), BrowserRouter
- `src/utils/authStorage.js` — token read/write helpers abstracting localStorage vs sessionStorage
- Vite proxy: `/api` → `localhost:3001` in development

### Branches
- `main` — production (auto-deploy)
- `dev` — active development; merge to `main` when ready to deploy
