# Dawrak (دَوْرَك) — Project Docs

> Living document. Maintained by: Claude (project overseer).
> Owner: Hazem.

---

## 1. Overview

- **Display Name:** دَوْرَك (with tashkeel, used across user-visible UI, app bars, titles, and PWA manifest).
- **Internal Name:** `dawrak` (used in codebase identifiers, package.json, routes, cookies such as `dawrak_session`, local storage keys such as `dawrak_device_id`, database entities, and environment variables).

Dawrak (دَوْرَك) is a queue-management system for the student affairs windows at the faculty. Each window has a QR code. A student scans it, picks the service they need (e.g., getting an enrollment certificate, printing a course registration form), and receives a queue number along with their current position.

Windows are staffed. The staff member controls the queue manually with a "Next" button.

**MVP goal:** Make the queue organized and transparent, reduce crowding and confusion at the windows, and keep the scope small enough to ship quickly.

---

## 2. MVP Scope

### In scope (v1)
- **Student page** (opened via the window's QR code):
  - List of services offered at the window.
  - Select a service and receive a queue number.
  - After taking a number: view the ticket number and how many people are ahead.
- **Staff panel:**
  - Authenticated access per assigned window.
  - Large display of the currently called number.
  - "Next" button to call the next person.
  - "Skip" button for a no-show; the skipped ticket is moved to the midpoint of the queue.
  - Live list of waiting tickets.
- **Super Admin Dashboard (`/admin`):**
  - Windows management: list, create, edit name/location, toggle active status, QR code links.
  - Services management: list, create, edit, toggle active status per window.
  - Staff accounts management: list, create (name, email, password), toggle active/deactive status, reset password.
  - Window assignments: assign staff accounts to specific windows in atomic transactions.
- **Authentication & Security:**
  - Argon2 password hashing (minimum 8 characters).
  - Secure signed JWT in `dawrak_session` httpOnly cookie (12-hour duration).
  - Brute-force rate limiting on login (10 attempts / 15 minutes / IP).
  - Role-based authorization for queue operations and admin dashboard.
- **Progressive Web App (PWA):**
  - Web App Manifest (RTL Arabic, standalone mode, primary blue theme `#2563EB`).
  - Service worker precaching app shell with `NetworkOnly` strategy for API and WebSocket traffic.
- **Live updates:** Socket.IO pushes queue updates to connected student and staff clients without page refresh. Handshake cookie auth & room authorization.
- **QR code generation:** one printable page per window.

### Out of scope (deferred)
- Student accounts and student login (students remain frictionless via persistent device ID).
- Self-registration and password reset via email.
- SMS or WhatsApp notifications.
- Service ratings and advanced analytics.
- Native mobile app.

---

## 3. Roles & Permissions

| Role | Permissions |
|---|---|
| **Student** | View active window services, take a ticket, track queue position, receive live Socket.IO queue updates. |
| **Window staff** | Log in, view their assigned window's queue, call next, skip tickets, mark served. (Access restricted to assigned windows via `window_staff`). |
| **Super Admin** | Full system control: manage windows, services, staff accounts, assignments, access all window staff panels. Cannot deactivate own account. |

---

## 4. User Flows

**Student**
1. Scans the window's QR code.
2. The window page opens with the list of services.
3. Selects a service and takes a ticket.
4. Watches the screen until their number is called.

**Staff**
1. Logs in via `/login` with staff email and password.
2. Automatically redirected to their assigned window at `/admin/:windowId`.
3. Sees the current number and waiting list live.
4. Presses "Next" when finished with the current student.
5. If the student does not respond, presses "Skip"; the ticket moves to the midpoint position.

**Super Admin**
1. Logs in via `/login` with super admin credentials.
2. Automatically redirected to `/admin`.
3. Manages windows, services, staff accounts, and staff assignments.

### 4.1 Queue Rules
- **Queue ordering:** Waiting tickets are ordered by `sort_key ASC`, tiebroken by `created_at ASC`.
- **Skip behavior:**
  - **First skip (`skip_count` 0 -> 1):** The currently called ticket returns to `waiting` status. Its `sort_key` is calculated using the midpoint method to insert it strictly after the next 3 waiting tickets without altering other rows:
    - If at least 4 waiting tickets exist, `sort_key = (k3 + k4) / 2` (midpoint between 3rd and 4th waiting neighbors).
    - If fewer than 4 waiting tickets exist, `sort_key = last_sort_key + 1` (placed at the end of the queue).
  - **Second skip (`skip_count` >= 1 -> 2):** The ticket is marked `cancelled` and removed from the active queue.
- **Concurrency & Stale clicks:**
  - Every call to `next` and `skip` accepts an optional `currentTicketId`. If the window's called ticket changed in the database, the operation aborts with `409 STALE_TICKET`.
  - Serialized database transactions guarantee atomic ticket creation and counter incrementing without gaps or duplicate numbers.

---

## 7. Schema

```
enum UserRole {
  SUPER_ADMIN
  STAFF
}

enum TicketStatus {
  waiting
  called
  served
  cancelled
}

users
  id            uuid        PK
  name          text
  email         text        UNIQUE (stored lowercase)
  password_hash text        -- Argon2 hash
  role          UserRole    DEFAULT 'STAFF'
  is_active     boolean     DEFAULT true
  created_at    timestamptz DEFAULT now()

window_staff
  window_id     uuid        PK, FK -> windows.id (CASCADE)
  user_id       uuid        PK, FK -> users.id (CASCADE)

windows
  id            uuid        PK
  name          text        -- window name
  location      text        -- building / floor
  is_active     boolean     DEFAULT true
  created_at    timestamptz DEFAULT now()

services
  id            uuid        PK
  window_id     uuid        FK -> windows.id (CASCADE)
  name          text        -- service name
  is_active     boolean     DEFAULT true

students
  id            uuid        PK (stored as TEXT)
  full_name     text        -- required
  phone         text        UNIQUE -- canonical 01XXXXXXXXX
  created_at    timestamp   DEFAULT now()

student_devices
  id            uuid        PK (stored as TEXT)
  device_id     uuid        UNIQUE (stored as TEXT)
  student_id    uuid        FK -> students.id (CASCADE)
  created_at    timestamp   DEFAULT now()

tickets
  id            uuid        PK
  window_id     uuid        FK -> windows.id
  service_id    uuid        FK -> services.id
  device_id     text        -- client device identifier
  student_id    uuid?       FK -> students.id (SET NULL)
  queue_date    date        -- numbering resets every day
  number        int         -- ticket number within the window for that day
  status        TicketStatus -- waiting | called | served | cancelled
  sort_key      decimal     -- queue sorting position
  skip_count    int         DEFAULT 0
  created_at    timestamptz
  called_at     timestamptz

  UNIQUE (window_id, queue_date, number)
  -- Partial unique index tickets_active_device_per_window
  -- on (window_id, device_id) for active statuses ('waiting', 'called')
  -- Partial unique index tickets_active_student_per_window
  -- on (student_id, window_id) for active statuses ('waiting', 'called')
```

### 7.1 Student identity (schema)

- `students` stores one durable row per student. IDs remain `String @default(uuid())` and are stored as PostgreSQL `TEXT`, matching the existing schema.
- `student_devices` maps exactly one `device_id` to one `student_id`. One student may have many devices. Deleting a student cascades to its device links.
- `tickets.student_id` is nullable for migration safety. Existing tickets remain unlinked (`NULL`); no backfill is performed.
- Phones are stored in the canonical Egyptian mobile format `01XXXXXXXXX`: 11 digits, starting with `01`, with the second digit in `{0, 1, 2, 5}`. The shared backend helper `normalizePhone` strips spaces, dashes, and parentheses, converts a leading `+20` or `0020` to `0`, and returns `null` for invalid input. The backend is authoritative.
- The `tickets_active_student_per_window` partial unique index enforces one active ticket per student per window. It is raw SQL because Prisma cannot express partial indexes:

```sql
CREATE UNIQUE INDEX tickets_active_student_per_window
  ON tickets (student_id, window_id)
  WHERE status IN ('waiting', 'called');
```

- This index, together with `tickets_active_device_per_window`, exists only in migration SQL and must not be removed by a future `migrate diff`.
- Registration, identity resolution, and staff display of student data are described in section 7.2.

### 7.2 Student identity flow and endpoints

A student is identified by the anonymous device UUID already stored in the browser (`dawrak_device_id`). No student account or password is created.

**Flow**

1. On `/w/:windowId`, the frontend calls `GET /api/student/me` with the device UUID.
2. If a student is linked, the service list is shown immediately.
3. If the device is not registered (`404 STUDENT_NOT_REGISTERED`), an Arabic registration card asks for full name and phone.
4. Registration links the device to an existing student when phone and normalized name match, or creates a student when the phone is new.
5. Ticket creation resolves `student_id` from `student_devices` on the server. A client-supplied student ID is never accepted.

**Linking and normalization rules**

- Phone is normalized to `01XXXXXXXXX` by the backend. The form accepts spaces, dashes, parentheses, `+20`, and `0020`; clearly invalid input is rejected inline before sending.
- Full name is trimmed and internal whitespace is collapsed. Matching against an existing student is exact and case-sensitive after normalization.
- Existing student data is never overwritten. A new device with an existing phone and matching name only adds a `student_devices` row.
- A phone/name mismatch returns a generic `409 PHONE_NAME_MISMATCH`. The response never says which field is wrong and never returns the stored name.
- A device already linked to a different student returns `409 DEVICE_ALREADY_LINKED`.
- Registration runs in a transaction. A unique-constraint race is retried once; a remaining race returns `409 REGISTRATION_CONFLICT` instead of a 500.

#### `GET /api/student/me?device_id=<uuid>`

Returns the student linked to the device. `device_id` must be a UUID.

Success `200`:

```json
{
  "id": "3f1b0c7e-0d38-4a4a-9f6e-7d5a1c2b9e11",
  "fullName": "Ahmed Ali",
  "phone": "01012345678"
}
```

Unknown device `404`:

```json
{
  "error": {
    "code": "STUDENT_NOT_REGISTERED",
    "message": "لم يتم تسجيل بيانات الطالب على هذا الجهاز."
  }
}
```

#### `POST /api/student/register`

Request:

```json
{
  "deviceId": "6d2f6a1e-6b7c-4f4e-8a0c-2f9b1d3e5a77",
  "fullName": "Ahmed Ali",
  "phone": "010 1234 5678"
}
```

Success `200` (same shape as `/me`):

```json
{
  "id": "3f1b0c7e-0d38-4a4a-9f6e-7d5a1c2b9e11",
  "fullName": "Ahmed Ali",
  "phone": "01012345678"
}
```

Validation failure `400`:

```json
{
  "error": {
    "code": "INVALID_INPUT",
    "message": "رقم الموبايل غير صالح، يجب أن يكون رقمًا مصريًا مكونًا من 11 رقمًا يبدأ بـ 01."
  }
}
```

**Error codes**

| HTTP | Code | Meaning |
|---|---|---|
| 400 | `INVALID_INPUT` | Invalid device UUID, name length, or phone format. No database writes. |
| 404 | `STUDENT_NOT_REGISTERED` | Device has no linked student. Returned by `/student/me` and ticket creation. |
| 409 | `PHONE_NAME_MISMATCH` | The phone exists but the normalized name differs. Generic message only. |
| 409 | `DEVICE_ALREADY_LINKED` | The device is already linked to a different student. |
| 409 | `REGISTRATION_CONFLICT` | A rare registration unique-constraint race survived one retry. |
| 409 | `ACTIVE_TICKET_EXISTS` | The device or the student already has a `waiting`/`called` ticket in this window. |

**Ticket creation**

`POST /api/windows/:id/tickets` still accepts `{ deviceId, serviceId }`. The server:

1. resolves the student from `student_devices` or returns `404 STUDENT_NOT_REGISTERED`;
2. rejects the request with `409 ACTIVE_TICKET_EXISTS` when either the device or the student already has an active ticket in that window;
3. stores the resolved `student_id` on the ticket.

Numbering, `sortKey`, skip count, no-show behavior, and the manual "next" flow are unchanged.

**Staff visibility and legacy tickets**

- `GET /api/windows/:id/queue` includes `student: { id, fullName, phone }` on the current and waiting tickets. This route already requires authentication and window assignment; super admins see every window.
- Tickets with `student_id = NULL` (created before this feature) remain valid. Staff see the neutral fallback `غير مسجل`, and the student is asked to register on their next scan. No backfill is performed.
- Student fields are never included in public responses.

**Public display privacy**

`GET /api/windows/:id/display`, `GET /api/tickets/:id`, and public `queue:update` socket snapshots contain only window, ticket number, status, and service data. They must never contain a student name or phone. Staff clients refetch the authenticated queue endpoint after a socket update so they still receive student details.

**Known limitation**

Linking relies on phone plus normalized name. There is no OTP or other proof of phone ownership yet, so anyone who knows both values can link a new device to an existing student. OTP verification is the planned follow-up.

---

## 8. API

### Public Routes
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Health check endpoint |
| GET | `/api/windows/:id` | Public window details |
| GET | `/api/windows/:id/display` | Public window display snapshot (read-only, called ticket & service, no student data) |
| GET | `/api/windows/:id/services` | Public active services for a window |
| POST | `/api/windows/:id/tickets` | Take a new ticket (body: `{ deviceId, serviceId }`). The device must be registered; the server resolves and stores `student_id`. |
| GET | `/api/tickets/:id` | Public ticket tracking status (no student data) |

### Student Identity Routes
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/student/me?device_id=<uuid>` | Returns the student linked to the device, or `404 STUDENT_NOT_REGISTERED`. |
| POST | `/api/student/register` | Register or link a device (body: `{ deviceId, fullName, phone }`). Returns the student record. |

### Authentication Routes
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/login` | Log in with `{ email, password }`. Rate-limited (10 req/15m). Sets `dawrak_session` httpOnly cookie. |
| POST | `/api/auth/logout` | Clears `dawrak_session` cookie. |
| GET | `/api/auth/me` | Returns current user session `{ id, name, role, windowIds }` or 401. |

### Staff Routes (requireAuth, requireWindowAccess)
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/windows/:id/queue` | Live queue snapshot (called and waiting tickets). Includes `student: { id, fullName, phone }` or `null` for legacy tickets; assigned staff and super admins only. |
| POST | `/api/windows/:id/next` | Serve current ticket and call next waiting ticket (body: `{ currentTicketId? }`) |
| POST | `/api/windows/:id/skip` | Skip currently called ticket with midpoint delay (body: `{ currentTicketId }`) |

### Admin Routes (requireAuth, requireSuperAdmin)
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/admin/windows` | List all windows with services and staff |
| POST | `/api/admin/windows` | Create window (`name`, `location`, `isActive`) |
| PATCH | `/api/admin/windows/:id` | Update window (`name`, `location`, `isActive`) |
| POST | `/api/admin/windows/:id/services` | Add service to window (`name`, `isActive`) |
| PATCH | `/api/admin/services/:id` | Update service (`name`, `isActive`) |
| GET | `/api/admin/users` | List all user accounts with assigned windows |
| POST | `/api/admin/users` | Create user (`name`, `email`, `password`, `role`) |
| PATCH | `/api/admin/users/:id` | Update user (`name`, `isActive`, `password`). Prevents self-deactivation. |
| PUT | `/api/admin/windows/:id/staff` | Replace staff assignments for window atomically (`{ userIds: uuid[] }`) |

### Socket.IO
- Handshake middleware verifies `dawrak_session` cookie.
- Room join `join:window`: Staff accounts are authorized only for windows they are assigned to (unauthorized join receives `error` event). Public students and Super Admins join freely.
- `queue:update` event is emitted on ticket changes.

---

## 9. Frontend Routes

- `/`: Redirects directly to `/login`.
- `/w/:windowId`: Student window page. Resolves the device's student identity; shows the registration form when the device is not registered, otherwise the service list and ticket flow.
- `/w/:windowId/ticket/:ticketId`: Student ticket live tracking page.
- `/qr/:windowId`: Window QR code display/print page.
- `/display/:windowId`: Public window queue display screen (not lazy-loaded, read-only, real-time socket updates, no student data).
- `/login`: Unified staff & super admin login page (lazy-loaded).
- `/admin`: Super Admin dashboard with Windows, Services, Staff, and Assignments management (lazy-loaded, `SuperAdminRoute`).
- `/admin/:windowId`: Window staff queue management panel (lazy-loaded, `StaffWindowRoute`, displays 403 on unassigned access).

---

## 10. Non-Functional Requirements & Security

- **Performance:** Student page bundle is optimized and lazy-loads all admin and login components.
- **Mobile first:** Material 3 design system with responsive layouts tested at 360px and 1280px.
- **Resilience:** Automatic reconnection banners and polling fallback when WebSocket disconnects.
- **Security:**
  - All input validated with Zod on the backend.
  - Argon2 password hashing.
  - HttpOnly, sameSite 'lax' JWT session cookies.
  - Brute-force rate limiting on `/login`.
  - Self-deactivation prevention for Super Admins.
- **PWA App Shell:** Precached assets via Workbox service worker. API and WebSocket traffic are strictly `NetworkOnly`.

---

## 11. Known Limitations

- **PWA Installation Context:** Service worker registration and PWA installation prompt strictly require **HTTPS** or **localhost**. Accessing the system over local LAN HTTP (e.g., `http://192.168.x.x:5173`) allows full responsive web usage, but browsers will not trigger the PWA install prompt.
- **Student identity verification:** Linking a new device to an existing student relies on phone plus normalized name. There is no OTP yet, so possession of both values is treated as proof of identity. See section 7.2.

---

## 12. Architectural Decisions

1. **Super Admin Bootstrap:** Super Admin account is bootstrapped via `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD` in `backend/.env`. Credentials are never committed to git.
2. **Password Policy:** Minimum 8 characters, hashed with Argon2.
3. **Session Management:** Signed JWT stored in an `httpOnly`, `sameSite: 'lax'` cookie named `dawrak_session` (valid for 12 hours). Avoids local storage XSS token exposure.
4. **Email Normalization:** All emails are stored lowercase and trimmed at registration, seed, and authentication.
5. **Atomic Assignments:** Window-staff assignments are replaced in a single database transaction to prevent orphaned or partial access states.
6. **Student Device Tracking:** Students are tracked via client-generated RFC 4122 v4 UUID with fallback to secure random values for LAN contexts without `crypto.randomUUID`.
