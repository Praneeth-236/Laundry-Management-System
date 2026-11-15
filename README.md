# Washday | Hostel Laundry Companion

[![CI](https://github.com/Praneeth-236/Laundry-Management-System/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/Praneeth-236/Laundry-Management-System/actions/workflows/ci.yml)

Washday helps hostel residents and people in shared homes keep track of their clothes, laundry days, and items still out for a wash. It is a full-stack MERN learning project built around one real workflow: know what you own, send available pieces to laundry, and record what came back.

**Live demo:** [washday-demo.onrender.com](https://washday-demo.onrender.com/) · [API health](https://washday-demo.onrender.com/api/health)

The demo uses free hosting and is for fictional data only. It can sleep when idle, and its local-disk photo storage can lose uploads after a restart. See [deployment limits and private storage setup](docs/DEPLOYMENT.md).

The Render blueprint explicitly uses `DEPLOYMENT_MODE=demo`. A real deployment must set `DEPLOYMENT_MODE=production`; startup then rejects local photo storage, missing SMTP, non-TLS MongoDB URIs, and non-HTTPS application URLs.

> **Learning project status:** the active application uses React, Express, Node.js, and MongoDB. The repo also preserves the earlier C and Flask prototypes under `legacy/`. Unit and API integration tests run in CI. Signed-in users can verify a recovery email, reset a password when SMTP is configured, export their data, and delete their account. This is not ready for real residents: migration rehearsal, backup/restore, monitoring, production photo-storage and SMTP configuration, retention terms, and an operational/security review are still outstanding.

## What you can do

- Create an account and manage a private clothing inventory.
- Verify a recovery email and reset a forgotten password when SMTP delivery is configured.
- Search and categorize clothing, including custom categories.
- Upload private clothing photos.
- Choose your laundry days.
- Send one or more items to a laundry cycle and track each return.
- Mark items missing, report laundry losses, and mark found items again.
- See a dashboard of available, missing, and in-laundry items.

## Stack

- **MongoDB 8** stores account, clothing, laundry-event, and session documents.
- **Express 5 / Node.js 22** provides a JSON API, server-side sessions, validation, and authorization.
- **React 19 / Vite 8** provides the responsive browser application and development server.
- **Mongoose 9** defines schemas, validation, indexes, and database transactions.

The dependency versions are pinned in the workspace manifests and `package-lock.json`. Node 22 is used because it is an LTS line supported by the selected MongoDB session-store package; current Node release status is published by the [Node.js project](https://nodejs.org/en/about/previous-releases). Current React, Express, Mongoose, and Vite package releases are published by their maintainers on [npm](https://www.npmjs.com/package/react), [npm](https://www.npmjs.com/package/express), [npm](https://www.npmjs.com/package/mongoose), and [npm](https://www.npmjs.com/package/vite).

## Get it running locally

You need Node.js 22.12 or newer in the 22.x line, npm, and Docker Desktop.

1. Clone the repository and install the workspace dependencies.

   ```powershell
   git clone https://github.com/Praneeth-236/Laundry-Management-System.git
   cd Laundry-Management-System
   npm ci
   ```

2. Create a local environment file and set a session secret.

   ```powershell
   Copy-Item .env.example .env
   $env:SESSION_SECRET = (node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))")
   ```

   Put the generated value into `.env` as `SESSION_SECRET`. Never commit `.env` or reuse the example value for a deployed app.

3. Start MongoDB as a one-node replica set. Transactions require a replica set, including for local development.

   ```powershell
   docker compose up -d mongo
   npm run db:init
   ```

   Wait until `localhost:27017` is elected primary. `docker compose exec mongo mongosh --quiet --eval "rs.status().myState"` should print `1`.

4. Start the API and React development server in separate terminals.

   Terminal A:

   ```powershell
   npm run dev:api
   ```

   Terminal B:

   ```powershell
   npm run dev:web
   ```

5. Open <http://127.0.0.1:5173> and create an account. Vite forwards `/api` requests to the Express server on port 4000.

The same steps work in macOS/Linux shells; use `cp .env.example .env` instead of `Copy-Item`.

## Run automated checks

```powershell
npm test
npm run build
```

For API integration checks, start and initialize the local MongoDB replica set first, then run `npm run test:integration`. Integration tests always use the separate `laundry_test` database and override any `MONGODB_URI` from `.env`.

## Build and run as one service

macOS/Linux:

```bash
npm run build
NODE_ENV=production npm start
```

PowerShell:

```powershell
npm run build
$env:NODE_ENV = "production"
npm start
```

Configure `MONGODB_URI` to a MongoDB replica-set cluster and set a long random `SESSION_SECRET`. Express serves the built React files from `client/dist`. For a container image, see `Dockerfile`; persist `/app/uploads` and use a MongoDB service with replica-set support.

## Learn the project, not just run it

Start with the guided path in [Learning Guide](docs/LEARNING_GUIDE.md). It follows a real request from a React button through Express middleware into MongoDB and back. The companion docs explain the API, database, security, and interview answers.

- [Learning Guide](docs/LEARNING_GUIDE.md)
- [API Reference](docs/API_REFERENCE.md)
- [Database and data model](docs/DATABASE.md)
- [Security decisions and remaining risks](docs/SECURITY.md)
- [Backup and restore runbook](docs/BACKUP_RESTORE.md)
- [Interview preparation](docs/INTERVIEW_PREP.md)
- [Roadmap](docs/ROADMAP.md)
- [Free demo deployment notes](docs/DEPLOYMENT.md)

## Try a free demo deployment

The free demo runs on Render with MongoDB Atlas. It is intended for fictional portfolio data, not real resident data; see [deployment limits and setup](docs/DEPLOYMENT.md) first.

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https%3A%2F%2Fgithub.com%2FPraneeth-236%2FLaundry-Management-System%2Ftree%2Fcodex%2Fproduction-readiness)

## Why MERN, and where the C program went

The original project was a C command-line laundry tracker. The first web prototype put Flask around that CLI and stored data in delimiter-separated files. That was useful as a first project, but it made authentication, persistence, and deployment difficult to explain as a real web system. The active app now uses MERN so you can study a browser UI, a JSON API, document modeling, sessions, and database transactions in one coherent codebase.

The original C source remains under `legacy/c-prototype/`; the Flask experiment and its SQLite transition are under `legacy/flask-prototype/`. They are references, not part of the running MERN app. The interview guide includes an honest way to explain this evolution.

## Current limits before real users

- Laundry days use the server's local time zone; personal time-zone settings and reminders are not implemented.
- This release tracks personal items and cycles. Shared machine booking, queues, and hostel administration are next-stage product work.
- Local disk remains the default for development. The server can use a private S3-compatible bucket for durable photos; configure it before a production deploy and keep object deletion and retention policies enabled.
- The automated suite covers validation, CSRF, authentication, registration/session rotation, ownership isolation, private photo access and cleanup, local/S3-compatible storage adapters, account export/deletion, a complete laundry return, and concurrent submissions; GitHub Actions runs API integration tests against a disposable MongoDB replica set.
- There is no release database migration system, automated backup/restore, or monitoring setup yet.
- No open-source license has been selected.
