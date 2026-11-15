# Free demo deployment

This recipe creates a public portfolio demo. It is not a production service for real residents. [Render says free instances are for previews and hobby projects, not production, and its free web service sleeps after 15 minutes without inbound traffic](https://render.com/docs/free). The local upload directory is ephemeral on this plan, so clothing photos may disappear when the service restarts. The API and database can also be slow to wake up.

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

1. After the deployment setup changes are merged into `main`, open the **Deploy to Render** button in the repository README. Render reads `render.yaml` and prepares a free Docker web service named `washday-demo`.
2. Review the service settings and confirm the free plan. Automatic deploys are off in the Blueprint; later code changes won't silently redeploy the demo.
3. Enter the Atlas URI for the `MONGODB_URI` environment variable. Render generates `SESSION_SECRET` from the blueprint.
4. Review the resources and click **Apply** (or **Deploy Blueprint**). Wait for `/api/health` to report `status: ok` and `database: connected`.
5. Open the Render URL, create a fictional demo account, and walk through add item → send to laundry → mark returned.

The free instance's file system is temporary. The blueprint stores uploads under `/tmp/washday-uploads`, so uploaded images can vanish across restarts. Treat this as a known demo limitation. Before using photos with real users, replace local disk storage with private object storage, configure retention/deletion, and test restore behavior.

## Promote beyond a demo

Use a paid, always-on application host; persistent private object storage; managed MongoDB with authenticated TLS, backups and restore drills; a shared rate-limit store; and a reviewed network allowlist. Add account verification, password recovery, data export/deletion, full integration tests, monitoring, alerting, and privacy/retention terms before inviting real residents. A free-tier deploy is a portfolio preview, not evidence that the app is production-ready.
