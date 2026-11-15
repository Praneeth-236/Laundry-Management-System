"""Import prototype flat files into the SQLite app database.

Run once with the old data files copied into the repository root. The command
never edits or removes those source files. It refuses to merge into a non-empty
database so operators can inspect and back up data before importing.
"""

from __future__ import annotations

import argparse
import json
import re
import secrets
import shutil
import sqlite3
import sys
from datetime import date, datetime, timezone
from pathlib import Path

REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPOSITORY_ROOT))

from app import ALLOWED_IMAGE_SIGNATURES, create_app


def utc_midnight(value: str) -> str:
    try:
        parsed = date.fromisoformat(value)
    except (ValueError, TypeError):
        parsed = datetime.now(timezone.utc).date()
    return datetime.combine(parsed, datetime.min.time(), timezone.utc).isoformat(timespec="seconds")


def copy_legacy_image(source_root: Path, user_id: int, image_name: str, upload_root: Path) -> str | None:
    if not image_name or image_name == "None":
        return None
    safe_name = Path(image_name).name
    if safe_name != image_name:
        return None
    source = source_root / "static" / safe_name
    if not source.is_file():
        return None
    if source.stat().st_size > 5 * 1024 * 1024:
        return None
    extension = source.suffix.lower()
    signatures = ALLOWED_IMAGE_SIGNATURES.get(extension)
    if not signatures:
        return None
    try:
        with source.open("rb") as image:
            header = image.read(12)
    except OSError:
        return None
    if not any(header.startswith(signature) for signature in signatures):
        return None
    if extension == ".webp" and header[8:12] != b"WEBP":
        return None
    key = secrets.token_hex(16) + extension
    destination_dir = upload_root / str(user_id)
    destination_dir.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, destination_dir / key)
    return key


def import_data(source_root: Path, database_path: Path, upload_root: Path) -> tuple[int, int, int]:
    users_path = source_root / "users.txt"
    if not users_path.is_file():
        raise SystemExit(f"No users.txt found in {source_root}")

    app = create_app({
        "TESTING": False,
        "DATABASE": str(database_path),
        "UPLOAD_FOLDER": str(upload_root),
    })
    with app.app_context():
        db = sqlite3.connect(database_path)
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA foreign_keys = ON")
        existing = db.execute("SELECT COUNT(*) FROM users").fetchone()[0]
        if existing:
            db.close()
            raise SystemExit("The destination database already has users. Back it up and import into an empty database.")

        imported_users = 0
        imported_items = 0
        imported_events = 0
        now = datetime.now(timezone.utc).isoformat(timespec="seconds")

        for line_number, line in enumerate(users_path.read_text(encoding="utf-8").splitlines(), start=1):
            if ":" not in line:
                print(f"Skipping malformed users.txt line {line_number}.")
                continue
            username, digest = line.split(":", 1)
            if not re.fullmatch(r"[A-Za-z0-9_]{3,20}", username) or not re.fullmatch(r"[a-fA-F0-9]{64}", digest):
                print(f"Skipping invalid legacy account on users.txt line {line_number}.")
                continue
            try:
                cursor = db.execute(
                    "INSERT INTO users (username, username_key, password_hash, created_at) VALUES (?, ?, ?, ?)",
                    (username, username.casefold(), "legacy-sha256:" + digest.lower(), now),
                )
            except sqlite3.IntegrityError:
                print(f"Skipping duplicate username {username!r} (case-insensitive duplicate).")
                continue
            user_id = cursor.lastrowid
            imported_users += 1

            closet_path = source_root / f"closet_{username}.txt"
            clothes_by_key: dict[tuple[str, str], tuple[int, bool]] = {}
            if closet_path.is_file():
                for row_number, raw_line in enumerate(closet_path.read_text(encoding="utf-8").splitlines(), start=1):
                    fields = raw_line.split(",", 6)
                    if len(fields) != 7:
                        print(f"Skipping malformed closet row {username}:{row_number}.")
                        continue
                    name, category, missing, in_laundry, lost_date, image, last_washed = fields
                    name, category = name.strip(), category.strip()
                    if not name or not category or len(name) > 80 or len(category) > 32:
                        print(f"Skipping invalid closet row {username}:{row_number}.")
                        continue
                    image_key = copy_legacy_image(source_root, user_id, image, upload_root)
                    try:
                        item_cursor = db.execute(
                            """INSERT INTO clothes
                               (user_id, name, category, image_key, is_missing, in_laundry, lost_date, last_washed, created_at)
                               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                            (user_id, name, category, image_key, int(missing == "1"), int(in_laundry == "1"),
                             None if lost_date in ("", "None") else lost_date,
                             None if last_washed in ("", "None", "Never") else last_washed, now),
                        )
                    except sqlite3.IntegrityError:
                        print(f"Skipping duplicate clothing item {username}:{name} ({category}).")
                        continue
                    clothes_by_key[(name, category)] = (item_cursor.lastrowid, in_laundry == "1")
                    imported_items += 1

            category_path = source_root / "custom_categories.json"
            if category_path.is_file():
                try:
                    category_data = json.loads(category_path.read_text(encoding="utf-8"))
                    values = category_data.get(username, [])
                    for category in values:
                        category = str(category).strip()
                        if category and len(category) <= 32:
                            db.execute("INSERT OR IGNORE INTO categories (user_id, name) VALUES (?, ?)",
                                       (user_id, category))
                except (json.JSONDecodeError, AttributeError, OSError):
                    print(f"Could not read custom categories for {username!r}.")

            pending_items: set[int] = set()
            history_path = source_root / f"laundry_history_{username}.txt"
            if history_path.is_file():
                for row_number, raw_line in enumerate(history_path.read_text(encoding="utf-8").splitlines(), start=1):
                    fields = raw_line.split(";", 3)
                    if len(fields) != 4:
                        print(f"Skipping malformed history row {username}:{row_number}.")
                        continue
                    sent_date, name, category, returned = fields
                    item = clothes_by_key.get((name, category))
                    if not item:
                        print(f"Skipping history without a matching item {username}:{row_number}.")
                        continue
                    cloth_id, _is_in_laundry = item
                    if returned.strip().casefold() == "pending":
                        status, returned_at = "pending", None
                        pending_items.add(cloth_id)
                    elif returned.strip() not in ("", "None"):
                        status, returned_at = "returned", utc_midnight(returned.strip())
                    else:
                        status, returned_at = "missing", None
                    try:
                        db.execute(
                            "INSERT INTO laundry_history (user_id, cloth_id, sent_at, returned_at, status) VALUES (?, ?, ?, ?, ?)",
                            (user_id, cloth_id, utc_midnight(sent_date.strip()), returned_at, status),
                        )
                    except sqlite3.IntegrityError:
                        print(f"Skipping duplicate pending history {username}:{row_number}.")
                        continue
                    imported_events += 1

            # Old closet files can report an item in laundry after its short,
            # capped history file has discarded the corresponding event.
            for item_id, is_in_laundry in clothes_by_key.values():
                if is_in_laundry and item_id not in pending_items:
                    db.execute(
                        "INSERT INTO laundry_history (user_id, cloth_id, sent_at, status) VALUES (?, ?, ?, 'pending')",
                        (user_id, item_id, now),
                    )
                    imported_events += 1

        db.commit()
        db.close()
        return imported_users, imported_items, imported_events


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=Path(__file__).resolve().parents[1],
                        help="Directory containing users.txt and the old per-user text files")
    parser.add_argument("--database", type=Path, default=REPOSITORY_ROOT / "instance/laundry.sqlite3",
                        help="Destination SQLite database (must be empty)")
    parser.add_argument("--uploads", type=Path, default=REPOSITORY_ROOT / "instance/uploads",
                        help="Destination private upload directory")
    args = parser.parse_args()
    counts = import_data(args.source.resolve(), args.database.resolve(), args.uploads.resolve())
    print(f"Imported {counts[0]} users, {counts[1]} clothing items, and {counts[2]} laundry records.")
    print("Legacy SHA-256 passwords will be replaced with secure hashes after each user's next successful login.")


if __name__ == "__main__":
    main()
