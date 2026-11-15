# Laundry Management System: product and engineering roadmap

## Product direction

Build a dependable laundry companion for people who manage clothes and laundry in a hostel or shared living space. A first release should make the everyday workflow clear: record laundry, see what is available or still out, track returns, and make shared laundry schedules easier to coordinate. Keep the personal closet useful on its own; make shared-room features an optional next layer.

## Current baseline

The repository is a Flask web application with server-rendered HTML and a standalone C command-line demo. The original C program stores records in per-user text files. The rebuilt web app uses SQLite directly and no longer starts the C program. Current web features include signup/login, a closet, missing-item tracking, per-account laundry days, and laundry history.

The current implementation is a prototype, not a production deployment. Important gaps found in the initial review:

- A one-time legacy text-file importer is available; rehearse it on a copy of representative data before relying on it for a real migration.
- The SQLite schema is initialized on startup, but it does not yet have versioned migrations.
- A schedule can be configured per account, but time-zone handling and reminders are not implemented.
- Image uploads are limited and owner-checked, but storage cleanup/retention and malware scanning need an operational policy.
- There are no automated checks, monitoring, recovery drills, or automated backup process yet.

## Delivery sequence

### 1. Finish the safe first release

- Add versioned database migrations and rehearse the legacy importer on backups, documenting any records it cannot preserve.
- Add automated unit and integration coverage for authentication, ownership boundaries, uploads, and laundry state transitions.
- Add rate limiting, explicit account recovery policy, structured logging, backups, and a tested restore procedure.
- Review image storage, retention, deployment secrets, HTTPS, and dependency update policy before inviting real users.

### 2. Grow the data model safely

- Add versioned schema migrations; keep SQLite for local development and a single persistent instance, then move to PostgreSQL before multi-instance hosting.
- Evolve per-item laundry history into explicit loads with stable IDs and timestamps when group workflows are introduced.
- Add transactional state changes so an item cannot be submitted twice or returned from the wrong load.
- Preserve backups and a repeatable import/export path for existing user data.

### 3. Ship the hostel-resident workflow

- Add time zones and reminders to the configurable laundry schedule.
- Track loads through created, sent, ready, returned, and issue-reported states.
- Add accessible responsive screens, empty states, search, and clear feedback for failed actions.
- Design optional shared laundry-room support: machine status, queue or reservation rules, and issue reports. Introduce this only after the personal workflow and ownership rules are stable.

### 4. Make it maintainable and demonstrable

- Organize routes, data access, configuration, and templates into clear modules.
- Add CI for formatting/linting and tests; document secrets, deployment, migrations, and backup/restore.
- Publish screenshots or a short demo, an architecture diagram, and a truthful feature/security status in the README.

## First-release acceptance criteria

- A new install can be configured from documented steps without manually editing source code.
- Passwords and sessions use secure configuration, and users cannot read or modify another user's records.
- All records survive restarts and have no fixed 100-item or 10-history-entry limit.
- Invalid, duplicate, or out-of-order laundry actions return clear feedback and leave data consistent.
- Every state-changing request is protected against cross-site request forgery.
- Automated checks run in CI and the README states exactly how to run the app and checks.

## Scope note

"Production-ready" should be treated as a release bar, not a single code change. This roadmap starts with correctness, privacy, and durable data before shared-machine features or notifications.
