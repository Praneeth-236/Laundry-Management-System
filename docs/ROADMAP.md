# Product and engineering roadmap

## Product direction

Start with the day-to-day personal laundry workflow that works for a hostel resident or anyone in a shared home. Then solve the larger shared-room problem: prevent wasted trips, clarify which machines are free, and give residents a fair way to coordinate access.

## Current MERN milestone

- Personal accounts, secure server-side sessions, CSRF protection.
- Clothing inventory, search, custom categories, and private photos.
- Configurable weekday schedule.
- Laundry status and per-item event history.
- Transactional status changes and a responsive React experience.
- Learning documentation mapped to the source code.

## Milestone 1: interview-quality engineering baseline

- Expand automated coverage with upload validation and session lifecycle edge cases; CI already checks concurrent laundry state transitions against a replica set.
- Add lint/format tooling and CI for install, tests, and production build.
- Add database migration scripts and rehearse import from old text-file data on a copied sample.
- Add a seed/demo-data command that only runs in development.
- Add polished screenshots and a short architecture walkthrough recording; a free-tier live demo is now available with fictional data only.

## Milestone 2: make one-hostel shared laundry useful

- Add hostel/workspace membership and roles.
- Model laundry rooms and machines with operational statuses (available, in use, out of service).
- Add reservation/queue rules with server-side fairness limits and conflict-safe updates.
- Add issue reports for broken machines and lost laundry.
- Add occupancy timers and clear notifications, with user-controlled notification preferences.

## Milestone 3: deploy for real users

- Add email verification, password recovery, account export/deletion, and documented privacy/retention rules.
- Move photos to private object storage and rate limits to a shared store.
- Add timezone-aware schedules and optional reminders.
- Use managed MongoDB with backups, TLS, least-privilege credentials, monitoring, structured logs, and an incident response contact.
- Run security review and recovery drills before a wider launch.

## Portfolio release bar

- Clean clone-to-run setup and a reproducible npm lockfile.
- CI is green for lint, tests, and a production build.
- Demo data and screenshots make the workflow easy to understand without sharing real resident data.
- README describes actual shipped features and known gaps honestly.
- Interview guide follows at least one feature from React state to database write and back.
