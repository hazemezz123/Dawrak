# Auth, Admin Dashboard & PWA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a secure, demo-ready version of Dawrak featuring user authentication (JWT in httpOnly cookies), role-based authorization (Super Admin & Window Staff), Admin management dashboard, PWA offline app-shell manifest, and automated verification suites.

**Architecture:**
- **Data Model:** PostgreSQL via Prisma: `User` model (uuid, name, email unique/lowercase, passwordHash, role enum, isActive, createdAt) and composite join model `WindowStaff` (windowId, userId).
- **Backend Auth & Authz:** Argon2 password hashing; signed 12-hour JWT in `dawrak_session` httpOnly cookie with rate-limiting on login (10 attempts/15 min); middleware for `requireAuth`, `requireSuperAdmin`, and `requireWindowAccess`; Socket.IO handshake auth & room access control.
- **Admin API:** REST endpoints under `/api/admin/*` for managing windows, services, staff accounts, and window-staff assignments in transactions.
- **Frontend:** Lazy-loaded `/login` and `/admin` routes; reactive auth context (`useAuth`); M3 design system with RTL tabs/sections for Windows, Services, Staff, and Assignments; route guards; PWA manifest & service worker configured via `vite-plugin-pwa` caching only the app shell.

**Tech Stack:**
- React 19, TypeScript, Vite, Tailwind CSS v4, TanStack Query, React Router v7, Socket.IO Client, `vite-plugin-pwa`.
- Node.js, Express, Prisma ORM, PostgreSQL, Argon2, JsonWebToken, Cookie-Parser, Express-Rate-Limit, Zod.
- Vitest, Supertest, Playwright.

**Spec:** `DOCS.md` and user task prompt.

## Global Constraints
- Do not reset existing database tables. Apply schema additions via a new Prisma migration.
- Generic login error on invalid email or password: "البريد الإلكتروني أو كلمة المرور غير صحيحة" (never reveal which failed).
- Passwords must be hashed using argon2 with a minimum length of 8 characters.
- Session cookie name: `dawrak_session`, httpOnly, sameSite 'lax', secure in production only.
- Super admin credentials bootstrapped from `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD` in `backend/.env`.
- Super admin cannot deactivate their own account.
- Public routes remain public: `GET /api/windows/:id`, `GET /api/windows/:id/services`, `POST /api/windows/:id/tickets`, `GET /api/tickets/:id`.
- Staff queue routes (`/queue`, `/next`, `/skip`) strictly require `requireAuth` and `requireWindowAccess`.
- Service worker precaches app shell only; NetworkOnly for `/api/*` and Socket.IO; never cache API responses.
- Keep student bundle light: `/login` and `/admin` lazy-loaded.

## Review Focus
1. Email casing: User emails must be trimmed and converted to lowercase during registration, seed, and login.
2. Inactive account handling: A deactivated user cannot log in and active sessions for deactivated users must be rejected by `requireAuth`.
3. Self-deactivation: Super admin attempting to deactivate their own account via `PATCH /api/admin/users/:id` must be rejected with 400.
4. Window staff assignment replacement: `PUT /api/admin/windows/:id/staff` must replace assignments atomically in a transaction without orphaned joins.
5. Socket.IO room guard: Unauthorized staff attempting to join `window:<id>` must be blocked and sent an error event, while public students remain unblocked.

---

### Task 1: Prisma Schema & Migration (PART 1)
**Files:**
- Modify: `backend/prisma/schema.prisma`
- Output: `backend/prisma/migrations/*_add_users_and_window_staff/migration.sql`

- [ ] **Step 1: Update `schema.prisma`**
  - Add enum `UserRole` with values `SUPER_ADMIN`, `STAFF`.
  - Add model `User` with `@map("users")`.
  - Add model `WindowStaff` with `@@id([windowId, userId])` and `@map("window_staff")`.
  - Add relations to `Window` model.
- [ ] **Step 2: Generate and apply migration**
  - Run: `cd backend; npx prisma migrate dev --name add_users_and_window_staff`
  - Verify migration succeeds without table recreation or data loss.
- [ ] **Step 3: Regenerate Prisma Client**
  - Run: `cd backend; npx prisma generate`

---

### Task 2: Backend Auth & Seed (PART 2)
**Files:**
- Create: `backend/src/lib/auth.ts`
- Create: `backend/src/routes/auth.ts`
- Modify: `backend/src/index.ts`
- Modify: `backend/src/seed.ts`
- Modify: `backend/.env.example`
- Modify: `backend/.env`

- [ ] **Step 1: Write auth utilities (`backend/src/lib/auth.ts`)**
  - Implement `hashPassword(password: string): Promise<string>` using `argon2`.
  - Implement `verifyPassword(hash: string, password: string): Promise<boolean>` using `argon2`.
  - Implement `generateSessionToken(payload: { userId: string; role: string }): string` (12h expiration).
  - Implement `verifySessionToken(token: string): { userId: string; role: string } | null`.
- [ ] **Step 2: Implement `/api/auth` routes (`backend/src/routes/auth.ts`)**
  - Rate-limit login: 10 requests per 15 min using `express-rate-limit`.
  - `POST /login`: Zod validate `{ email, password }`, lowercase email, verify credentials, reject inactive, set `dawrak_session` httpOnly cookie.
  - `POST /logout`: Clear `dawrak_session` cookie.
  - `GET /me`: Return `{ id, name, role, windowIds }` or 401.
- [ ] **Step 3: Update Super Admin Seed (`backend/src/seed.ts`)**
  - Read `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD` from environment.
  - Upsert super admin if missing; update `.env.example`.
- [ ] **Step 4: Register `cookie-parser` and auth routes in `backend/src/index.ts`**

---

### Task 3: Authorization Middleware & Socket.IO Guard (PART 3)
**Files:**
- Modify: `backend/src/middleware/auth.ts`
- Modify: `backend/src/routes/windows.ts`
- Modify: `backend/src/index.ts`

- [ ] **Step 1: Implement authorization middleware (`backend/src/middleware/auth.ts`)**
  - `requireAuth`: parse JWT from `dawrak_session` cookie, fetch user from DB, ensure `user.isActive`, attach `req.user`.
  - `requireSuperAdmin`: verify `req.user.role === 'SUPER_ADMIN'`.
  - `requireWindowAccess`: middleware checking `windowId` (from params). If `SUPER_ADMIN`, next. If `STAFF`, check `WindowStaff` join table; if missing return 403.
- [ ] **Step 2: Protect staff routes in `backend/src/routes/windows.ts`**
  - Protect `GET /:id/queue`, `POST /:id/next`, and `POST /:id/skip` with `requireAuth` and `requireWindowAccess`.
  - Keep public routes public: `GET /:id`, `GET /:id/services`, `POST /:id/tickets`.
- [ ] **Step 3: Socket.IO Connection & Room Authorization (`backend/src/index.ts`)**
  - In `io.use()`, parse cookie and attach authenticated user to `socket.data.user` (if cookie exists).
  - On `join:window`, if user is authenticated staff, verify they have window access or send `error` event and reject join.

---

### Task 4: Admin API Endpoints (PART 4)
**Files:**
- Create: `backend/src/routes/admin.ts`
- Modify: `backend/src/index.ts`

- [ ] **Step 1: Implement `backend/src/routes/admin.ts` behind `requireAuth, requireSuperAdmin`**
  - `GET /api/admin/windows`: list windows with services and staff.
  - `POST /api/admin/windows`: create window (`name`, `location`, `isActive`).
  - `PATCH /api/admin/windows/:id`: update window.
  - `POST /api/admin/windows/:id/services`: add service.
  - `PATCH /api/admin/services/:id`: update service (`name`, `isActive`).
  - `GET /api/admin/users`: list users with assigned window IDs.
  - `POST /api/admin/users`: create user (hash password, lowercase email, default `STAFF`).
  - `PATCH /api/admin/users/:id`: update user (`name`, `isActive`, optional `password`). Prevent super admin self-deactivation.
  - `PUT /api/admin/windows/:id/staff`: atomic assignment replacement using transaction.
- [ ] **Step 2: Mount `/api/admin` in `backend/src/index.ts`**

---

### Task 5: Backend Test Suite (PART 7 Backend)
**Files:**
- Create: `backend/src/__tests__/auth-admin.test.ts`
- Modify: `backend/package.json`

- [ ] **Step 1: Write integration tests covering all Part 7 requirements:**
  - Login success with cookie set.
  - Login failure with wrong password returns generic Arabic message.
  - Rate limiting triggers after 10 attempts.
  - Deactivated user cannot log in.
  - Staff user gets 403 on unassigned window queue/next/skip.
  - Staff user gets 403 on admin routes.
  - Super admin passes admin routes.
  - Super admin cannot deactivate self.
  - Socket.IO unassigned staff join rejected.
- [ ] **Step 2: Run and verify backend tests pass:** `cd backend; npm test`

---

### Task 6: Frontend Auth & Admin Dashboard (PART 5)
**Files:**
- Create: `frontend/src/context/AuthContext.tsx`
- Create: `frontend/src/pages/LoginPage.tsx`
- Create: `frontend/src/pages/AdminDashboardPage.tsx`
- Modify: `frontend/src/pages/StaffPanelPage.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/lib/api.ts`

- [ ] **Step 1: Auth Client & Context (`frontend/src/context/AuthContext.tsx`)**
  - Manage `user` state, `login`, `logout`, `isLoading`.
  - Handle role-based redirects.
- [ ] **Step 2: Build `/login` (`frontend/src/pages/LoginPage.tsx`)**
  - M3 card, RTL Arabic, email and password fields, error presentation, submit redirection.
- [ ] **Step 3: Build Admin Dashboard (`frontend/src/pages/AdminDashboardPage.tsx`)**
  - Tabs/Sections: Windows, Services per Window, Staff Accounts, Staff Assignments.
  - Full CRUD operations with modals/forms and immediate optimistic or query invalidations.
- [ ] **Step 4: Update `StaffPanelPage.tsx`**
  - Add Top App Bar logout button and user info.
  - Remove "login pending" placeholder notice.
- [ ] **Step 5: Setup Route Guards in `frontend/src/App.tsx`**
  - Public student routes remain open.
  - `/login`: public (redirects if already authenticated).
  - `/admin`: protected, `SUPER_ADMIN` only.
  - `/admin/:windowId`: protected, `SUPER_ADMIN` or assigned `STAFF` (shows 403 message for unassigned staff).

---

### Task 7: PWA Setup & Manifest (PART 6)
**Files:**
- Modify: `frontend/vite.config.ts`
- Create: `frontend/public/pwa-192x192.png`
- Create: `frontend/public/pwa-512x512.png`
- Modify: `frontend/index.html`

- [ ] **Step 1: Configure `vite-plugin-pwa` in `frontend/vite.config.ts`**
  - Set manifest: name "دورك", short_name "دورك", lang "ar", dir "rtl", start_url "/", display "standalone", theme_color "#2563EB", background_color "#F8FAFC".
  - Configure workbox: precache app shell only; runtime caching NetworkOnly for `/api/*` and Socket.IO.
- [ ] **Step 2: Generate PNG icons (192px and 512px) with `#2563EB` background**
- [ ] **Step 3: Update `index.html` with theme-color and manifest link**

---

### Task 8: Frontend Tests & Verification (PART 7 Frontend)
**Files:**
- Create: `frontend/src/__tests__/auth-admin.test.tsx`
- Modify: `frontend/src/__tests__/StaffPanelPage.test.tsx`

- [ ] **Step 1: Write unit tests for:**
  - Login form submission and redirection based on role.
  - Admin assignment save sends correct user IDs.
  - Unauthorized staff sees 403 message.
- [ ] **Step 2: Run all frontend tests and production build:**
  - Run: `cd frontend; npm test`
  - Run: `cd frontend; npm run build`

---

### Task 9: Playwright End-to-End Suite & Screenshots (PART 8)
**Files:**
- Create: `e2e-demo-v1.mjs`
- Output: `C:/mnt/user-data/outputs/screenshots/demo-v1/*.png`

- [ ] **Step 1: Implement automated Playwright script `e2e-demo-v1.mjs`:**
  - Super admin login -> create staff account -> assign to Window 1 -> logout.
  - Staff login at 360px -> verify access to Window 1 and not Window 2.
  - Student takes ticket -> staff panel updates live.
  - Staff attempts `/admin/<window2-id>` -> verifies 403 message.
  - Capture required screenshots:
    - `admin-dashboard-360px.png`
    - `admin-dashboard-1280px.png`
    - `staff-login-360px.png`
    - `staff-panel-360px.png`
- [ ] **Step 2: Run script and verify output images and flows**

---

### Task 10: Documentation Update (PART 9)
**Files:**
- Modify: `DOCS.md`

- [ ] **Step 1: Update `DOCS.md` sections:**
  - Section 2: Admin panel and staff auth in scope.
  - Section 3: User roles (`Student`, `Window staff`, `Super Admin`).
  - Section 7: Updated schema with `users` and `window_staff`.
  - Section 8: Auth and admin endpoints documented.
  - Section 9: Frontend routes (`/login`, `/admin`, `/admin/:windowId`).
  - Section 12: Decisions recorded (Argon2, JWT httpOnly cookie, Super admin bootstrap, PWA HTTPS requirement).
  - Known limitations: PWA requires HTTPS or localhost; LAN HTTP won't install app.
