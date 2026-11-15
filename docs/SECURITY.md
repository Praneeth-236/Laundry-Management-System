# Security decisions and limits

This file describes what the code currently does and the work that remains. It is not a claim that the application has received a security audit.

## Implemented in this learning build

### Authentication and sessions

- Passwords are hashed with bcryptjs at cost 12; plaintext passwords are never persisted.
- The login query selects `passwordHash` explicitly. Normal user responses omit it.
- Successful sign-in regenerates the session ID.
- Password-reset tokens are generated with the operating system CSPRNG, stored only as SHA-256 hashes, expire after 30 minutes, and are consumed atomically with the password update. Reset invalidates all existing server-side sessions for that account.
- Recovery emails are accepted only after explicit verification. Password-reset requests use a generic response whether or not a verified account exists.
- The browser receives the session ID in an HTTP-only, SameSite=Lax cookie. The cookie is Secure when `NODE_ENV=production`.
- Session contents are stored in MongoDB, not the Express in-memory store.
- Login and registration share an IP-based rate limit stored in MongoDB, so counters are shared between API processes. MongoDB stores a keyed HMAC digest of the rate-limit key rather than the raw IP. Expired counter documents are removed by a MongoDB TTL index.
- Login failure text does not say whether the username or password was wrong.

### Request and data protection

- POST, PATCH, and DELETE requests require a random synchronizer CSRF token stored in the server-side session and sent in `X-CSRF-Token`.
- Helmet installs common security headers; Express's `X-Powered-By` header is disabled.
- Requests receive an `X-Request-ID` and structured access log with method, path, status, and duration. Query strings, request bodies, and client IPs are not logged. Unexpected errors include the request ID in logs and error responses.
- Zod validates API input; Mongoose validates persisted document shape.
- Every private list and mutation scopes its MongoDB query to the user ID from the server-side session. ObjectIds in the URL are not treated as proof of ownership.
- MongoDB unique indexes enforce case-insensitive clothing duplicates and at most one pending laundry event per item.
- Laundry status and event changes use MongoDB transactions so the records commit or roll back together.
- JSON bodies are limited to 100 KB.
- Email address changes require the current password. A changed address is unverified until its one-time verification token is redeemed.

### Photo handling

- Multer stores one image in memory and limits it to 5 MB. Multipart requests are limited to two text fields, three total parts, and 8 KB per text field.
- Photo uploads are capped at 30 per account per 24-hour window using the shared MongoDB rate-limit store. Requests without a photo do not use this quota.
- The server checks extension, declared MIME type, and leading file signature.
- The stored file receives a random server-generated name and is outside the public static directory. The S3-compatible adapter does not create public URLs or set public ACLs; operators must keep bucket public access disabled. Photo reads pass through the authenticated, owner-scoped API.
- Image reads require login and owner-scoped database lookup. The response is marked private and non-cacheable.

## Operational assumptions

- Production traffic must use HTTPS. Set `NODE_ENV=production` behind a correctly configured trusted proxy so Secure cookies work.
- `DEPLOYMENT_MODE=production` adds startup checks for HTTPS app URLs, TLS MongoDB, configured SMTP delivery, and private S3-compatible photo storage. The free portfolio instance deliberately sets `DEPLOYMENT_MODE=demo`; it must not be treated as a production configuration.
- MongoDB must require authentication and TLS in any deployed environment. The local Compose database binds only to loopback and is for development.
- `SESSION_SECRET` must be a long random secret held in the hosting platform's secret manager.
- Local photo storage needs a persistent volume on a single server. For multiple instances or ephemeral hosts, configure the private S3-compatible backend with bucket-scoped credentials. The application never serves bucket URLs directly.

## Known gaps

- Unit tests cover input validation, CSRF/authentication middleware, and local/S3-compatible storage adapter behavior. API integration tests cover registration/session rotation, ownership isolation, authenticated photo streaming and cleanup, upload MIME/signature/size/multipart limits, shared rate-limit counters across store instances, account export/deletion, a laundry cycle, and concurrent requests for the same item; CI runs them against a disposable replica set.
- Rate-limit counters share the application MongoDB deployment. Keep the `rate_limits` collection on the same protected database and monitor its availability along with authentication.
- Account export and password-confirmed account deletion are implemented. Deletion revokes all sessions. Email verification and password recovery are implemented when SMTP is configured; the free demo does not currently have SMTP configured. MFA and an account deletion retention/audit policy are not implemented.
- Archiving a clothing item removes its photo from the configured storage; its laundry history remains. There is no scheduled orphan-object sweep or general retention policy yet. Account deletion attempts object cleanup after its database transaction and logs failures for later operational review.
- No malware scanning, account-level audit log, monitoring alert, or incident-response process is configured.
- `trust proxy` is set to one hop in production. The exact setting must match the deployed network path.
- Database migration and backup/restore procedures have not been rehearsed.
- A [backup and restore runbook](BACKUP_RESTORE.md) is documented, but no Atlas snapshot schedule, bucket backup, or restore drill has been configured or verified.

## Before inviting real users

Run the upload, shared-rate-limit, concurrency, recovery-token, and photo-storage adapter cases in CI and review their results. Configure managed MongoDB authentication/TLS, private object storage, SMTP, backup/restore, and an account deletion retention/audit policy. Perform a deployment review. Until then, treat this as a learning application.
