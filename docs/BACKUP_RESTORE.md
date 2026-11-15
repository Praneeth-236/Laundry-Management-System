# Backup and restore runbook

This is an operator checklist, not evidence that Washday backups are currently configured. The public free demo uses an Atlas M0 cluster and ephemeral Render storage; use fictional data only. No backup schedule or restore drill has been verified for the live demo.

## Recovery targets

Before real residents use the service, the operator must choose and record:

- **RPO (recovery point objective):** the maximum amount of recent laundry data the service can lose.
- **RTO (recovery time objective):** the maximum time the service can remain unavailable during recovery.
- Who can start a restore, who reviews it, and how residents are notified.

These targets determine the database tier, backup frequency, retention, and on-call coverage. Atlas backup features vary by cluster tier and configuration; confirm them for the actual cluster in Atlas before launch. See [MongoDB's Atlas backup guidance](https://www.mongodb.com/docs/atlas/architecture/current/backups/).

## What needs a backup

| Data | Source of truth | Recovery requirement |
| --- | --- | --- |
| Users, clothes, categories, laundry history | MongoDB application database | Managed snapshot or PITR plan, retained outside the app host |
| Private clothing photos | S3-compatible bucket | Separate object retention/replication/versioning plan; verify the needed keys remain available |
| Login sessions | MongoDB `sessions` collection | Prefer to invalidate sessions after restore; users can sign in again |
| Rate-limit counters | MongoDB `rate_limits` collection | Safe to expire and rebuild; they are not user records |
| Configuration and recovery material | Hosting secret manager and operator vault | Keep separate from database snapshots; never put secrets in this repository or in the backup archive |

Database snapshots do not contain object bytes. A restored clothing record can point to a photo key whose object is missing, so database and bucket recovery must be planned together. Account deletion can also remove bucket objects outside the MongoDB transaction; check logs for failed cleanup before declaring a restore complete.

## Configure backups before launch

1. Select a managed MongoDB cluster tier that supports the backup frequency and retention required by the recorded RPO/RTO. Verify backup status and restore permissions in the provider console.
2. Enable automated backups and point-in-time recovery if available for that tier. Restrict backup and restore permissions to named operators; enable provider MFA.
3. Configure a separate recovery strategy for the private photo bucket. Keep public access disabled and use credentials scoped to the Washday bucket. Record how to restore an object by key without making the bucket public.
4. Record the database and object-storage backup locations, retention, responsible operator, and provider support links in the team's private operations vault.
5. Confirm that the application environment is `DEPLOYMENT_MODE=production` only when the production configuration checks pass. A successful app health check does not prove backups exist.

## Quarterly restore rehearsal

Run this exercise against an isolated staging environment. Do not point a restore command at the production database.

1. Choose a recent database snapshot and record its timestamp and provider restore-job identifier.
2. Restore it to a new, isolated staging database with different credentials and network rules. Keep the production URI unavailable to the test operators for this step.
3. Restore the matching photo bucket snapshot or sample objects to a private staging bucket. Preserve object keys or record the mapping needed by staging.
4. Set staging-only `MONGODB_URI`, `S3_BUCKET`, and S3 credentials in the staging secret manager. Keep production secrets out of the staging service.
5. Start the staging application. Startup recreates the current Mongoose indexes. Confirm `/api/health` reports the database connected.
6. In staging, check a sample resident, clothing list, category, pending and returned laundry history, and corresponding photos. Confirm a photo request still requires authentication and item ownership.
7. Clear staging sessions so copied cookies are invalidated. Re-authenticate test users and verify recovery email configuration separately.
8. Record elapsed recovery time, recovered snapshot time, missing records/photos, log errors, and follow-up actions. Compare the results with the RTO/RPO targets.
9. Destroy the isolated restore only after evidence is stored in the private operations vault. Never add backup files or real user data to GitHub or attach them to this project.

## Incident restore checklist

1. Declare the incident, freeze writes if data integrity is in doubt, and identify the latest known-good database and bucket recovery points.
2. Notify the incident owner and confirm the target account, region, and restore point. A second operator should review the target before any production restore.
3. Restore to an isolated database first. Validate application records and photo availability before routing production traffic to it.
4. Rotate `SESSION_SECRET` after a suspected compromise and invalidate all restored sessions. Rotate MongoDB and bucket credentials if they may have been exposed.
5. Change production secrets to the validated restore only after approval by the incident owner. Keep a copy of the original provider snapshot and incident logs.
6. Confirm health, sign-in, an owner-scoped data read, a photo read, and one safe laundry workflow. Watch structured logs for database, object-storage, and email errors.
7. Document data loss against RPO, downtime against RTO, resident communications, and corrective work.

## Current limitation

The repo does not automate Atlas snapshots, S3 object backups, or a restore. The Render free demo is not covered by a verified backup or recovery promise. Do not represent this runbook as an executed disaster-recovery test; complete and record a rehearsal on the chosen paid production providers before real users rely on Washday.
