# sistema_di_manutenzione — backend

REST + Socket.io API for a maintenance management system (MMS) for
an industrial plant: operators raise fault reports, managers plan
interventions, maintenance workers execute them, an HSE safety
role handles safety-typed faults, and admins manage users, plants
and machine parts.

The frontend lives in a separate repo:
[sistema_di_manutenzione-frontend](https://github.com/AlesssMAK/sistema_di_manutenzione-frontend).

## Stack

- **Runtime** — Node.js 22, ES modules
- **Web** — Express 5 with celebrate (Joi) request validation
- **DB** — MongoDB via Mongoose 8 (sessions persisted with
  `connect-mongo`)
- **Realtime** — Socket.io for live fault updates and direct/role
  broadcast messaging
- **Auth** — session cookies, role-based access (no JWT)
- **Email** — Nodemailer with a stub / SMTP driver toggle and an
  in-memory per-recipient rate limiter
- **Scheduling** — `node-cron` for overdue/replan jobs, anchored to
  `SystemSettings.timezone` (Europe/Rome by default)
- **Admin panel** — AdminJS mounted under `/admin`
- **Date math** — Luxon
- **API docs** — Swagger UI under `/api-docs`
- **Tests** — Vitest + Supertest + `mongodb-memory-server`

## Roles

The role names below are the canonical strings used everywhere in
the API and on the FE. The italian labels in `messages/it.json`
map to these one-to-one.

| Role | What they do |
|---|---|
| `operator` | Files new fault reports, sees their own history |
| `manager` | Plans/reassigns interventions, sets priority+deadline, picks maintainers |
| `maintenanceWorker` | Executes assigned faults, updates status, claims pool faults |
| `safety` | Handles `typeFault: 'Safety'` faults end-to-end (HSE notes) |
| `admin` | Manages users, plants, machine parts; reads audit log |

## Features

- **Fault lifecycle**: created → in progress → suspended → overdue
  → completed, with audit history pushed on every transition.
- **Planning + reassign + add-maintainers**: separate endpoints
  for first-time planning, full reassign, and append-only crew
  extension. Emails sent only to the right delta.
- **Pool / claim**: managers can leave a fault unassigned; eligible
  maintainers claim from the calendar.
- **Auto-replan / overdue cron**: nightly job marks overdue faults
  and reschedules ones that lost their planned slot.
- **Messaging**: direct messages and role-broadcasts with a
  per-direction unread-count split, TTL on broadcasts.
- **Audit log**: every server-side mutation is logged with actor,
  target, summary; TTL-pruned per `SystemSettings.retention`.
- **System settings**: a singleton document the admin edits live
  (timezone, work hours, slot duration, email triggers, cron flags,
  retention windows). Changes hot-reload affected services.

## Getting started

```bash
git clone https://github.com/AlesssMAK/sistema_di_manutenzione-backend
cd sistema_di_manutenzione-backend
npm install
cp .env.example .env  # then fill in MONGO_URL, ADMIN_*, EMAIL_*, etc.
npm run bootstrap-admin   # one-off: creates the first admin user
npm run dev               # http://localhost:3040
```

Swagger UI: <http://localhost:3040/api-docs>
AdminJS: <http://localhost:3040/admin>

### Required env vars

See `.env.example` — at minimum:

- `MONGO_URL` — local mongo or Atlas connection string
- `FRONTEND_URL` — used for CORS and email links (defaults to
  `http://localhost:3000`)
- `ADMIN_COOKIE_SECRET` + `ADMIN_SESSION_SECRET` — strong random
  strings; AdminJS won't boot without them
- `EMAIL_DRIVER=stub` for local dev (emails print to stdout);
  `smtp` for real delivery with `SMTP_*` set
- `CLOUDINARY_*` — required for fault-image uploads
- `CRON_ENABLED=false` when running tests

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | `nodemon` development server with reload |
| `npm start` | Production server |
| `npm run seed` | Populate a fresh DB with sample plants, parts and users |
| `npm run bootstrap-admin` | Create the first admin (interactive) |
| `npm test` | Vitest run (no watch) |
| `npm run test:watch` | Vitest in watch mode |
| `npm run test:coverage` | Vitest with v8 coverage |

## Layout

```
src/
  app.js                  Express app + middleware wiring
  server.js               Bootstrap + graceful shutdown
  admin/                  AdminJS config + auth
  controllers/            Route handlers grouped by feature
  routes/                 Express routers
  models/                 Mongoose schemas
  validations/            celebrate / Joi schemas per route
  services/               Email, audit log, system settings,
                          messaging side-effects
  cron/                   node-cron scheduler, overdue + replan jobs
  socket/                 Socket.io setup + emitters
  middleware/             auth, audit, error handler, etc.
  constants/              Enums (STATUS, TYPE_FAULT, etc.)
```
