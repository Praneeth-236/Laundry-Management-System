# Security decisions and limits

This file describes what the code currently does and the work that remains. It is not a claim that the application has received a security audit.

## Implemented in this learning build

### Authentication and sessions

- Passwords are hashed with bcryptjs at cost 12; plaintext passwords are never persisted.
- The login query selects `passwordHash` explicitly. Normal user responses omit it.
- Successful sign-in regenerates the session ID.
- The browser receives the session ID in an HTTP-only, SameSite=Lax cookie. The cookie is Secure when `NODE_ENV=production`.
- Session contents are stored in MongoDB, not the Express in-memory store.
- Login and registration share an IP-based rate limit stored in MongoDB, so counters are shared between API processes. Expired counter documents are removed by a MongoDB TTL index.
- Login failure text does not say whether the username or password was wrong.

### Request and data protection

- POST, PATCH, and DELETE requests require a random synchronizer CSRF token stored in the server-side session and sent in `X-CSRF-Token`.
- Helmet installs common security headers; Express's `X-Powered-By` header is disabled.
- Zod validates API input; Mongoose validates persisted document shape.
- Every private list and mutation scopes its MongoDB query to the user ID from the server-side session. ObjectIds in the URL are not treated as proof of ownership.
- MongoDB unique indexes enforce case-insensitive clothing duplicates and at most one pending laundry event per item.
- Laundry status and event changes use MongoDB transactions so the records commit or roll back together.
- JSON bodies are limited to 100 KB.

### Photo handling

- Multer stores one image in memory and limits it to 5 MB. Multipart requests are limited to two text fields, three total parts, and 8 KB per text field.
- The server checks extension, declared MIME type, and leading file signature.
- The stored file receives a random server-generated name and is outside the public static directory.
- Image reads require login and owner-scoped database lookup. The response is marked private and non-cacheable.

## Operational assumptions

- Production traffic must use HTTPS. Set `NODE_ENV=production` behind a correctly configured trusted proxy so Secure cookies work.
- MongoDB must require authentication and TLS in any deployed environment. The local Compose database binds only to loopback and is for development.
- `SESSION_SECRET` must be a long random secret held in the hosting platform's secret manager.
- Local photo storage needs a persistent volume on a single server. Do not horizontally scale this setup until photos use private object storage.

## Known gaps

- Automated unit tests cover input validation, CSRF checks, and authentication middleware. API integration tests cover registration/session rotation, ownership isolation, private-photo cleanup, upload MIME/signature/size/multipart limits, shared rate-limit counters across store instances, account export/deletion, a laundry cycle, and concurrent requests for the same item; CI runs them against a disposable replica set.
- Rate-limit counters share the application MongoDB deployment. Keep the `rate_limits` collection on the same protected database and monitor its availability along with authentication.
- Account export and password-confirmed account deletion are implemented. Deletion revokes all sessions. Recovery, email verification, MFA, and an account deletion retention/audit policy are not implemented.
- Archiving a clothing item removes its stored photo; its laundry history remains. There is no scheduled orphan-file sweep, general retention policy, or object-storage deletion workflow yet.
- No malware scanning, object-storage policy, structured audit log, monitoring alert, or incident-response process is configured.
- `trust proxy` is set to one hop in production. The exact setting must match the deployed network path.
- Database migration and backup/restore procedures have not been rehearsed.

## Before inviting real users

Run the upload, shared-rate-limit, and concurrency integration cases in CI and review their results. Configure managed MongoDB authentication/TLS, private object storage, backup/restore, account recovery, and an account deletion retention/audit policy. Perform a deployment review. Until then, treat this as a learning application.
