# Laundry Management System

A personal laundry companion for people in hostels and shared homes. Keep a digital closet, record laundry cycles, set your laundry days, and track missing or returned items.

> **Project status:** actively being rebuilt from a prototype. The current web app uses Flask and SQLite. It is suitable for local development and a single persistent app instance; the legacy importer still needs rehearsal, while multi-instance hosting, automated checks, and operational monitoring remain before a public production launch.

## Current features

- Account signup and login with salted, work-factor password hashing.
- A private clothing inventory with categories, search, and image uploads.
- Per-account laundry schedules and cycle history.
- Item status for available, in laundry, and missing clothing.
- SQLite persistence with ownership checks on records and uploaded images.
- CSRF protection for forms that change data.

## Technology

- Python 3.11+
- Flask 3.1
- SQLite (included with Python)
- Waitress WSGI server
- HTML templates, Bootstrap, and vanilla JavaScript
- `main.c` is retained as a standalone learning/demo program. The web app no longer invokes it.

## Run locally

1. Clone the repository and open its directory.

   ```bash
   git clone https://github.com/Praneeth-236/Laundry-Management-System.git
   cd Laundry-Management-System
   ```

2. Create and activate a virtual environment.

   ```powershell
   py -3.11 -m venv .venv
   .\.venv\Scripts\Activate.ps1
   ```

   On macOS or Linux, use `python3 -m venv .venv` and `source .venv/bin/activate`.

3. Install dependencies and set a local session secret.

   ```bash
   python -m pip install -r requirements.txt
   ```

   PowerShell:

   ```powershell
   $env:LAUNDRY_SECRET_KEY = (python -c "import secrets; print(secrets.token_hex(32))")
   ```

   macOS/Linux:

   ```bash
   export LAUNDRY_SECRET_KEY="$(python -c 'import secrets; print(secrets.token_hex(32))')"
   ```

4. Start the development server.

   ```bash
   flask --app app run --debug
   ```

   Open <http://127.0.0.1:5000>. The app creates its SQLite database and private upload directory under `instance/` on first launch.

## Production-minded single-instance run

Use a stable secret, a persistent volume for `instance/`, HTTPS at the hosting layer, and the Waitress server. Do not run Flask's development server with debug mode enabled in production.

```bash
python -m pip install -r requirements.txt
export APP_ENV=production
export LAUNDRY_SECRET_KEY="replace-with-a-long-random-secret"
waitress-serve --listen=0.0.0.0:8000 app:app
```

The SQLite database and uploaded images must stay on persistent storage. Back up both together. This setup is for one application instance; move to PostgreSQL and object storage before running multiple instances or relying on the app for a larger hostel.

### Docker

```bash
docker build -t laundry-management .
docker run --rm -p 8000:8000 \
  -e APP_ENV=production \
  -e LAUNDRY_SECRET_KEY="replace-with-a-long-random-secret" \
  -v laundry-data:/app/instance \
  laundry-management
```

Keep the secret outside the image and use a hosting platform's secret manager for deployed environments.

## Data and migration note

The current database is `instance/laundry.sqlite3`; uploads are in `instance/uploads/`. The old prototype used `users.txt`, `closet_<username>.txt`, `laundry_history_<username>.txt`, and `custom_categories.json`. A one-time importer is available for these files:

1. Stop the old app and make a separate backup of all legacy data files and `static/` images.
2. Copy the legacy files into the repository root (do not commit them; they contain private account data).
3. Run `python tools/import_legacy_data.py --source . --database instance/laundry.sqlite3 --uploads instance/uploads` against an empty destination database.

The importer leaves the old files untouched and refuses to merge into a database that already has users. Imported SHA-256 password hashes are checked at login and upgraded after a successful login. Images with unsupported or invalid file signatures are skipped. Review the import summary and inspect the new database and uploads before deleting any backup.

## Roadmap

See [ROADMAP.md](ROADMAP.md) for the product direction, security and reliability work, first-release acceptance criteria, and the next stages for hostel/shared-laundry features.

## Contributing

Issues and focused pull requests are welcome. Please include a clear problem statement, steps to reproduce, and the behavior you expect. Automated checks and contribution instructions will be added as the project hardens.

## License

No license has been selected yet. Until one is added, reuse and redistribution are not granted by this repository.
