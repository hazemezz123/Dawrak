# Student Identity Persistence — Design

**Date:** 2026-10-31
**Status:** Approved; schema migration applied. Endpoints and UI are not implemented yet.

## Intent

Students currently exist only as anonymous device UUIDs. A student who changes
phones, clears storage, or uses a second device loses their queue history and can
hold multiple active tickets. This change gives each student one durable record
keyed by an Egyptian mobile number, while keeping the scan-to-ticket flow free of
passwords.

## Goals

- Ask for full name and phone once per device.
- Return the student automatically on later visits from the same device.
- Link a new device to an existing student when phone and normalized name match.
- Attach every new ticket to a server-resolved student.
- Prevent one student from holding two active tickets in the same window.
- Show student name and phone to staff on assigned windows only.

## Non-goals

- OTP or any other proof of phone ownership.
- Student login, passwords, or profile editing.
- Backfilling existing tickets/devices.
- Exposing student data on the public display or public ticket status endpoints.

## Approaches considered

1. **New `students` + `student_devices` tables, nullable `tickets.student_id`** —
   chosen. Matches the requested model, keeps one student across many devices,
   and allows the migration to land while old tickets are still valid.
2. **Store name/phone directly on each ticket/device row** — rejected. There is no
   single student record to deduplicate or link devices to.
3. **Make phone the device key and drop anonymous devices** — rejected. Existing
   devices and tickets would break, and a phone change would lose identity.

## Design decisions

- Phone is normalized by removing whitespace and dashes, then validated against
  `^01[0125]\d{8}$` on both sides. The backend is authoritative.
- Full name is trimmed and internal whitespace is collapsed. Matching is exact
  and case-sensitive after that normalization. No diacritic/variant folding.
- Registration runs in a transaction. A unique-constraint race is retried once in
  a fresh transaction so a concurrently-created phone record can be resolved
  normally.
- A device already linked to a different student always receives
  `DEVICE_ALREADY_LINKED`; no stored data is overwritten.
- A phone/name mismatch receives a generic `PHONE_NAME_MISMATCH`; the stored name
  is never returned.
- Ticket creation resolves `student_id` from `student_devices` by `device_id`.
  A client-supplied student ID is ignored because the request schema never accepts
  one. An unregistered device receives `STUDENT_NOT_REGISTERED`.
- Legacy tickets keep `student_id = NULL`. They remain visible to staff with a
  neutral "not registered" fallback, and those students are asked to register on
  their next scan. No backfill is attempted.
- Public display and public ticket endpoints stay free of student data. Staff
  queue data includes the student because those routes already require auth and
  window assignment.

## Data model (proposed)

New `students` table, new `student_devices` table, nullable `tickets.student_id`.
The second partial unique index is raw SQL:

```sql
CREATE UNIQUE INDEX tickets_active_student_per_window
  ON tickets (student_id, window_id)
  WHERE status IN ('waiting', 'called');
```

`student_id IS NULL` rows do not conflict in PostgreSQL, so legacy tickets are
safe.

## API

| Method | Endpoint | Result |
|---|---|---|
| GET | `/api/student/me?device_id=...` | Student, or `404 STUDENT_NOT_REGISTERED` |
| POST | `/api/student/register` | Existing/new student |
| POST | `/api/windows/:id/tickets` | Ticket with server-resolved `student_id` |

New error codes:

- `STUDENT_NOT_REGISTERED` — 404, device has no student link.
- `PHONE_NAME_MISMATCH` — 409, generic Arabic message.
- `DEVICE_ALREADY_LINKED` — 409, device belongs to another student.

Ticket conflicts keep `ACTIVE_TICKET_EXISTS` for both the device rule and the
student rule, with the same clear Arabic message.

## Frontend

`StudentWindowPage` checks `/api/student/me` after obtaining the device UUID. On
`STUDENT_NOT_REGISTERED` it shows an Arabic RTL registration card; on success it
sets the query data and reveals the service list immediately. Name/phone stay in
component state only. The registration form validates inline, normalizes the
phone before sending, and shows the exact requested mismatch message without
identifying the field.

Staff queue cards show `student.fullName` and `student.phone`; legacy null
students show a fallback.

## Tests

Backend integration coverage:

- new student + device creation;
- returning device recognition;
- new device with matching phone/name links to the same student;
- same phone with wrong name is rejected;
- second active ticket for the same student in one window is rejected;
- invalid Egyptian phone is rejected.

Existing frontend tests are updated to stub identity resolution. The registration
gate gets a component test.

## Documentation

`DOCS.md` gets the new tables, endpoints, error codes, linking rule, and the
known limitation that linking is phone + name only until OTP is added.
