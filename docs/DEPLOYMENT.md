# Free demo deployment

This recipe creates a public portfolio demo. It is not a production service for real residents. [Render says free instances are for previews and hobby projects, not production, and its free web service sleeps after 15 minutes without inbound traffic](https://render.com/docs/free). The default local upload directory is ephemeral on this plan, so photos may disappear when the service restarts. The API and database can also be slow to wake up.

## Services

- **Render free Docker web service** builds the app with the repository's `Dockerfile` and serves the React app and API on the same origin.
- **MongoDB Atlas M0** provides the free MongoDB replica set needed by the app's transaction-based laundry cycle. [MongoDB describes the free cluster as suitable for learning, development, and small proof-of-concept workloads](https://www.mongodb.com/docs/atlas/tutorial/deploy-free-tier-cluster/).

This is a $0 demo configuration while both accounts remain on their free tiers. It does not promise uptime, backups, persistent photo storage, or support. Do not enter real names, resident details, or sensitive clothing photos. Use fictional demo data.

## Prepare MongoDB Atlas

1. Create an Atlas project and an M0 free cluster in a region near the Render service.
2. Create a database user with a unique strong password. Do not reuse the Atlas account password.
3. Add the Render service's outbound network range to the Atlas IP access list. For a temporary portfolio demo only, Atlas's `0.0.0.0/0` rule can be used with a strong database password; it allows connections from any IP and is not a production network policy.
4. Copy the application connection string and replace the password placeholder. Include the app database name and `retryWrites=true&w=majority`; Atlas connection strings support replica-set transactions.
5. Keep the URI private. Never commit it to the repository or use it in screenshots.

## Deploy on Render

1. Open the **Deploy to Render** button in the `codex/production-readiness` branch README. It selects that CI-verified branch; Render reads its `render.yaml` and prepares a free Docker web service named `washday-demo`.
2. Review the service settings and confirm the free plan. Automatic deploys are off in the Blueprint; later code changes won't silently redeploy the demo.
3. Enter the Atlas URI for the `MONGODB_URI` environment variable. Render generates `SESSION_SECRET` from the blueprint.
4. Review the resources and click **Apply** (or **Deploy Blueprint**). Wait for `/api/health` to report `status: ok` and `database: connected`.
5. Open the Render URL, create a fictional demo account, and walk through add item → send to laundry → mark returned.

The Render blueprint sets `DEPLOYMENT_MODE=demo` because this free instance uses ephemeral local photo storage and does not have an email provider configured. Before moving a service to real users, set `DEPLOYMENT_MODE=production` only after setting up private S3-compatible photo storage, SMTP, an HTTPS `PUBLIC_APP_URL`, and a MongoDB URI with TLS. Washday validates these requirements at process startup and exits with field-specific errors when one is missing. This catches incomplete production configuration; it does not verify the host's backup policy, bucket access policy, or provider account settings.

The free instance's file system is temporary. With the default `PHOTO_STORAGE_DRIVER=local`, uploads under `/tmp/washday-uploads` can vanish across restarts. For persistent photos, the app supports a private S3-compatible bucket such as [Cloudflare R2](https://developers.cloudflare.com/r2/get-started/s3/). R2 accepts S3 SDK clients and uses an account endpoint with region `auto`.

### Configure email verification and password recovery

1. Choose an SMTP provider and create a sender identity for your Washday domain. Use a provider that supports authenticated TLS.
2. In Render's environment settings, set `SMTP_HOST`, `SMTP_PORT` (usually `587` with `SMTP_SECURE=false` or `465` with `SMTP_SECURE=true`), `SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_FROM` (a bare sender address such as `no-reply@your-domain.example`).
3. Set `PUBLIC_APP_URL` to the public HTTPS base URL of the app, with no trailing slash.
4. Save and deploy. Create a fictional account with an inbox you control, follow the verification link, then request a password reset and confirm the new password works.

The demo does not currently have SMTP configured. Until you configure it, email verification and password reset are unavailable, and test accounts cannot recover a forgotten password. Keep SMTP credentials only in Render's secret environment settings.

### Configure private Cloudflare R2 photo storage

1. Create an R2 bucket. Keep public access disabled; Washday streams photos through its authenticated API after checking item ownership.
2. Create an R2 API token with Object Read & Write permissions scoped to this bucket. Copy its access key, secret key, and the account's S3 endpoint.
3. In Render, open the web service's environment settings and set `PHOTO_STORAGE_DRIVER=s3`, `S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com`, `S3_REGION=auto`, and `S3_BUCKET=<bucket-name>`.
4. Add `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY` as secret environment variables in Render. Never commit them to `.env.example`, screenshots, or Git.
5. Save and deploy the service. Sign in with a fictional account, upload a test image, load it from the closet, archive the item, and confirm the image is no longer available. Repeat after a service restart to confirm persistence.

The adapter also removes photos during account deletion on a best-effort basis. A database transaction cannot atomically include a separate object-storage service, so review server logs for cleanup failures and plan an orphan-object reconciliation process before a real-user launch. Back up the bucket and test restore behavior as part of the release checklist.

## Promote beyond a demo

Use a paid, always-on application host; configured private object storage and SMTP; managed MongoDB with authenticated TLS, backups and restore drills; and a reviewed network allowlist. The application now shares login rate-limit counters through MongoDB; monitor that dependency with the authentication path. Add deletion retention policy, monitoring, alerting, privacy/retention terms, and an operational/security review before inviting real residents. A free-tier deploy is a portfolio preview, not evidence that the app is production-ready.
