"""Laundry companion web application.

The original C CLI remains in the repository as a standalone learning example.
The web app stores its data transactionally in SQLite and never shells out to it.
"""

from __future__ import annotations

import hmac
import hashlib
import os
import re
import secrets
import sqlite3
from datetime import date, datetime, timezone
from functools import wraps
from pathlib import Path

from flask import (
    Flask,
    abort,
    current_app,
    flash,
    g,
    redirect,
    render_template,
    request,
    send_from_directory,
    session,
    url_for,
)
from werkzeug.security import check_password_hash, generate_password_hash
from werkzeug.utils import secure_filename

BASE_DIR = Path(__file__).resolve().parent
DEFAULT_CATEGORIES = (
    "Shirt", "T-shirt", "Pants", "Jeans", "Kurta", "Pyjama", "Towels",
    "Bed Sheets", "Pillow Covers", "Shorts",
)
ALLOWED_IMAGE_SIGNATURES = {
    ".png": (b"\x89PNG\r\n\x1a\n",),
    ".jpg": (b"\xff\xd8\xff",),
    ".jpeg": (b"\xff\xd8\xff",),
    ".gif": (b"GIF87a", b"GIF89a"),
    ".webp": (b"RIFF",),
}


def create_app(config: dict | None = None) -> Flask:
    app = Flask(__name__, instance_relative_config=True)
    app.config.from_mapping(
        SECRET_KEY=os.environ.get("LAUNDRY_SECRET_KEY"),
        DATABASE=os.environ.get("LAUNDRY_DATABASE", str(Path(app.instance_path) / "laundry.sqlite3")),
        UPLOAD_FOLDER=os.environ.get("LAUNDRY_UPLOAD_FOLDER", str(Path(app.instance_path) / "uploads")),
        MAX_CONTENT_LENGTH=5 * 1024 * 1024,
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE="Lax",
        SESSION_COOKIE_SECURE=os.environ.get("APP_ENV") == "production",
    )
    if config:
        app.config.update(config)
    if not app.config.get("SECRET_KEY"):
        if os.environ.get("APP_ENV") == "production":
            raise RuntimeError("LAUNDRY_SECRET_KEY must be configured in production.")
        app.config["SECRET_KEY"] = secrets.token_hex(32)

    Path(app.instance_path).mkdir(parents=True, exist_ok=True)
    Path(app.config["UPLOAD_FOLDER"]).mkdir(parents=True, exist_ok=True)
    initialize_database(app)
    register_routes(app)
    return app


def connect_db() -> sqlite3.Connection:
    if "db" not in g:
        g.db = sqlite3.connect(current_app.config["DATABASE"])
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA foreign_keys = ON")
        g.db.execute("PRAGMA busy_timeout = 5000")
    return g.db


def initialize_database(app: Flask) -> None:
    Path(app.config["DATABASE"]).parent.mkdir(parents=True, exist_ok=True)
    schema = BASE_DIR / "schema.sql"
    with sqlite3.connect(app.config["DATABASE"]) as db:
        db.execute("PRAGMA foreign_keys = ON")
        db.executescript(schema.read_text(encoding="utf-8"))


def close_db(_error: Exception | None = None) -> None:
    db = g.pop("db", None)
    if db is not None:
        db.close()


def utc_timestamp() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def csrf_token() -> str:
    token = session.get("_csrf_token")
    if not token:
        token = secrets.token_urlsafe(32)
        session["_csrf_token"] = token
    return token


def require_login(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        if "user_id" not in session:
            return redirect(url_for("login"))
        return view(*args, **kwargs)
    return wrapped


def register_routes(app: Flask) -> None:
    app.teardown_appcontext(close_db)
    app.jinja_env.globals["csrf_token"] = csrf_token

    @app.before_request
    def protect_forms():
        if request.method == "POST":
            submitted = request.form.get("csrf_token", "")
            expected = session.get("_csrf_token", "")
            if not expected or not hmac.compare_digest(submitted, expected):
                abort(400, description="The form expired. Reload the page and try again.")

    @app.route("/")
    def home():
        if "user_id" in session:
            return redirect(url_for("dashboard"))
        return render_template("home.html")

    @app.route("/signup", methods=["GET", "POST"])
    def signup():
        if request.method == "POST":
            username = request.form.get("username", "").strip()
            password = request.form.get("password", "")
            if not re.fullmatch(r"[A-Za-z0-9_]{3,20}", username):
                flash("Use 3-20 letters, numbers, or underscores for your username.", "danger")
            elif len(password) < 12 or len(password) > 256:
                flash("Use a password between 12 and 256 characters.", "danger")
            else:
                db = connect_db()
                try:
                    cursor = db.execute(
                        "INSERT INTO users (username, username_key, password_hash, created_at) VALUES (?, ?, ?, ?)",
                        (username, username.casefold(), generate_password_hash(password), utc_timestamp()),
                    )
                    db.commit()
                except sqlite3.IntegrityError:
                    flash("That username is already taken.", "warning")
                else:
                    session.clear()
                    session["user_id"] = cursor.lastrowid
                    session["username"] = username
                    return redirect(url_for("dashboard"))
            return render_template("signup.html")
        return render_template("signup.html")

    @app.route("/login", methods=["GET", "POST"])
    def login():
        if request.method == "POST":
            username = request.form.get("username", "").strip()
            user = connect_db().execute(
                "SELECT id, username, password_hash FROM users WHERE username_key = ?",
                (username.casefold(),),
            ).fetchone()
            password = request.form.get("password", "")
            valid_password = False
            if user and user["password_hash"].startswith("legacy-sha256:"):
                legacy_digest = user["password_hash"].split(":", 1)[1]
                valid_password = hmac.compare_digest(hashlib.sha256(password.encode()).hexdigest(), legacy_digest)
                if valid_password:
                    connect_db().execute("UPDATE users SET password_hash = ? WHERE id = ?",
                                          (generate_password_hash(password), user["id"]))
                    connect_db().commit()
            elif user:
                valid_password = check_password_hash(user["password_hash"], password)
            if user and valid_password:
                session.clear()
                session["user_id"] = user["id"]
                session["username"] = user["username"]
                return redirect(url_for("dashboard"))
            flash("Invalid username or password.", "danger")
        return render_template("login.html")

    @app.route("/logout", methods=["POST"])
    def logout():
        session.clear()
        flash("You have been logged out.", "info")
        return redirect(url_for("login"))

    @app.route("/dashboard")
    @require_login
    def dashboard():
        row = connect_db().execute(
            """SELECT COUNT(*) AS total,
                      SUM(CASE WHEN is_missing = 1 THEN 1 ELSE 0 END) AS missing,
                      SUM(CASE WHEN in_laundry = 1 THEN 1 ELSE 0 END) AS laundry
               FROM clothes WHERE user_id = ?""",
            (session["user_id"],),
        ).fetchone()
        total = row["total"] or 0
        missing = row["missing"] or 0
        in_laundry = row["laundry"] or 0
        return render_template(
            "dashboard.html", total_clothes=total, missing_count=missing,
            in_laundry_count=in_laundry,
            available_count=max(0, total - missing - in_laundry), active_page="dashboard",
        )

    @app.route("/closet", methods=["GET", "POST"])
    @require_login
    def closet():
        db = connect_db()
        user_id = session["user_id"]
        categories = list(DEFAULT_CATEGORIES)
        categories.extend(row["name"] for row in db.execute(
            "SELECT name FROM categories WHERE user_id = ? ORDER BY name", (user_id,)
        ))
        if request.method == "POST":
            name = request.form.get("name", "").strip()
            category = request.form.get("category", "").strip()
            if not name or len(name) > 80 or category not in categories:
                flash("Enter an item name (up to 80 characters) and choose a valid category.", "danger")
                return redirect(url_for("closet"))
            image_key = save_uploaded_image(request.files.get("image"), user_id)
            if image_key is False:
                return redirect(url_for("closet"))
            try:
                db.execute(
                    "INSERT INTO clothes (user_id, name, category, image_key, created_at) VALUES (?, ?, ?, ?, ?)",
                    (user_id, name, category, image_key, utc_timestamp()),
                )
                db.commit()
            except sqlite3.IntegrityError:
                discard_uploaded_image(image_key, user_id)
                flash("An item with that name already exists in this category.", "warning")
            else:
                flash("Clothing item added.", "success")
            return redirect(url_for("closet"))

        search = request.args.get("search", "").strip().casefold()
        category_filter = request.args.get("filter_category", "").strip()
        rows = db.execute(
            "SELECT * FROM clothes WHERE user_id = ? AND is_missing = 0 ORDER BY category, name",
            (user_id,),
        ).fetchall()
        grouped = {}
        for row in rows:
            if search and search not in row["name"].casefold():
                continue
            if category_filter and category_filter != row["category"]:
                continue
            grouped.setdefault(row["category"], []).append(row)
        return render_template("closet.html", closet_by_category=grouped,
                               categories=categories, search_query=search,
                               filter_category=category_filter, active_page="closet")

    @app.route("/add_category", methods=["POST"])
    @require_login
    def add_category():
        category = request.form.get("new_category", "").strip()
        if not category or len(category) > 32 or category.casefold() in {x.casefold() for x in DEFAULT_CATEGORIES}:
            flash("Enter a category name up to 32 characters that is not already built in.", "danger")
        else:
            try:
                connect_db().execute(
                    "INSERT INTO categories (user_id, name) VALUES (?, ?)",
                    (session["user_id"], category),
                )
                connect_db().commit()
                flash("Category added.", "success")
            except sqlite3.IntegrityError:
                flash("That category already exists.", "warning")
        return redirect(url_for("closet"))

    @app.route("/items/<int:item_id>/delete", methods=["POST"])
    @require_login
    def delete_cloth(item_id: int):
        db = connect_db()
        result = db.execute("DELETE FROM clothes WHERE id = ? AND user_id = ?", (item_id, session["user_id"]))
        db.commit()
        flash("Item deleted." if result.rowcount else "Item not found.", "info")
        return redirect(url_for("closet"))

    @app.route("/items/<int:item_id>/missing", methods=["POST"])
    @require_login
    def mark_missing(item_id: int):
        db = connect_db()
        result = db.execute(
            "UPDATE clothes SET is_missing = 1, lost_date = ? WHERE id = ? AND user_id = ? AND in_laundry = 0",
            (date.today().isoformat(), item_id, session["user_id"]),
        )
        db.commit()
        flash("Item marked missing." if result.rowcount else "Item could not be marked missing.", "info")
        return redirect(url_for("closet"))

    @app.route("/items/<int:item_id>/found", methods=["POST"])
    @require_login
    def mark_received(item_id: int):
        db = connect_db()
        result = db.execute(
            "UPDATE clothes SET is_missing = 0, lost_date = NULL WHERE id = ? AND user_id = ? AND is_missing = 1",
            (item_id, session["user_id"]),
        )
        db.commit()
        flash("Item marked as found." if result.rowcount else "Item not found.", "info")
        return redirect(url_for("missing_clothes"))

    @app.route("/items/<int:item_id>/image")
    @require_login
    def item_image(item_id: int):
        row = connect_db().execute(
            "SELECT image_key FROM clothes WHERE id = ? AND user_id = ?",
            (item_id, session["user_id"]),
        ).fetchone()
        if not row or not row["image_key"]:
            abort(404)
        user_dir = Path(current_app.config["UPLOAD_FOLDER"]) / str(session["user_id"])
        return send_from_directory(user_dir, row["image_key"])

    @app.route("/laundry", methods=["GET", "POST"])
    @require_login
    def laundry():
        db = connect_db()
        user_id = session["user_id"]
        today = date.today()
        user = db.execute("SELECT laundry_days FROM users WHERE id = ?", (user_id,)).fetchone()
        user_days = user["laundry_days"].split(",") if user and user["laundry_days"] else ["Monday", "Thursday"]
        current_day = today.strftime("%A")
        can_submit = current_day in user_days
        if request.method == "POST":
            if not can_submit:
                flash(f"Your laundry schedule does not allow submissions today ({current_day}).", "warning")
                return redirect(url_for("laundry"))
            item_ids = list(dict.fromkeys(request.form.getlist("clothes")))
            if not item_ids or len(item_ids) > 100:
                flash("Select between 1 and 100 clothing items.", "warning")
                return redirect(url_for("laundry"))
            try:
                ids = [int(value) for value in item_ids]
            except ValueError:
                flash("The selected items were invalid.", "danger")
                return redirect(url_for("laundry"))
            placeholders = ",".join("?" for _ in ids)
            items = db.execute(
                f"SELECT id FROM clothes WHERE user_id = ? AND is_missing = 0 AND in_laundry = 0 AND id IN ({placeholders})",
                [user_id, *ids],
            ).fetchall()
            if len(items) != len(ids):
                flash("One or more selected items are no longer available. Refresh and try again.", "warning")
                return redirect(url_for("laundry"))
            sent_at = utc_timestamp()
            for item in items:
                cursor = db.execute(
                    "INSERT INTO laundry_history (user_id, cloth_id, sent_at, status) VALUES (?, ?, ?, 'pending')",
                    (user_id, item["id"], sent_at),
                )
                db.execute("UPDATE clothes SET in_laundry = 1 WHERE id = ? AND user_id = ?", (item["id"], user_id))
            db.commit()
            flash(f"{len(items)} item(s) added to this laundry cycle.", "success")
            return redirect(url_for("laundry"))

        available = db.execute(
            "SELECT * FROM clothes WHERE user_id = ? AND is_missing = 0 AND in_laundry = 0 ORDER BY category, name",
            (user_id,),
        ).fetchall()
        history = db.execute(
            """SELECT h.id, h.sent_at, h.returned_at, h.status, c.name, c.category
               FROM laundry_history h JOIN clothes c ON c.id = h.cloth_id
               WHERE h.user_id = ? ORDER BY h.sent_at DESC LIMIT 100""",
            (user_id,),
        ).fetchall()
        return render_template("laundry.html", closet=available, laundry_history=history,
                               user_days=user_days, can_submit=can_submit, current_day=current_day,
                               active_page="laundry")

    @app.route("/laundry/<int:history_id>/return", methods=["POST"])
    @require_login
    def mark_received_laundry(history_id: int):
        db = connect_db()
        row = db.execute(
            "SELECT cloth_id FROM laundry_history WHERE id = ? AND user_id = ? AND status = 'pending'",
            (history_id, session["user_id"]),
        ).fetchone()
        if not row:
            flash("That laundry record is not pending.", "warning")
            return redirect(url_for("laundry"))
        db.execute("UPDATE laundry_history SET status = 'returned', returned_at = ? WHERE id = ?",
                   (utc_timestamp(), history_id))
        db.execute("UPDATE clothes SET in_laundry = 0, last_washed = ? WHERE id = ? AND user_id = ?",
                   (date.today().isoformat(), row["cloth_id"], session["user_id"]))
        db.commit()
        flash("Item marked as returned.", "success")
        return redirect(url_for("laundry"))

    @app.route("/laundry/<int:history_id>/missing", methods=["POST"])
    @require_login
    def mark_missing_laundry(history_id: int):
        db = connect_db()
        row = db.execute(
            "SELECT cloth_id FROM laundry_history WHERE id = ? AND user_id = ? AND status = 'pending'",
            (history_id, session["user_id"]),
        ).fetchone()
        if not row:
            flash("That laundry record is not pending.", "warning")
            return redirect(url_for("laundry"))
        db.execute("UPDATE laundry_history SET status = 'missing' WHERE id = ?", (history_id,))
        db.execute("UPDATE clothes SET in_laundry = 0, is_missing = 1, lost_date = ? WHERE id = ? AND user_id = ?",
                   (date.today().isoformat(), row["cloth_id"], session["user_id"]))
        db.commit()
        flash("Item marked missing from laundry.", "info")
        return redirect(url_for("missing_clothes"))

    @app.route("/missing_clothes")
    @require_login
    def missing_clothes():
        missing = connect_db().execute(
            "SELECT * FROM clothes WHERE user_id = ? AND is_missing = 1 ORDER BY lost_date DESC, name",
            (session["user_id"],),
        ).fetchall()
        return render_template("missing_clothes.html", missing=missing, active_page="missing_clothes")

    @app.route("/profile", methods=["GET", "POST"])
    @require_login
    def profile():
        db = connect_db()
        if request.method == "POST":
            if request.form.get("action") == "password":
                user = db.execute("SELECT password_hash FROM users WHERE id = ?", (session["user_id"],)).fetchone()
                current = request.form.get("current_password", "")
                new_password = request.form.get("new_password", "")
                if not user or not check_password_hash(user["password_hash"], current):
                    flash("Current password is incorrect.", "danger")
                elif len(new_password) < 12 or len(new_password) > 256:
                    flash("Use a new password between 12 and 256 characters.", "danger")
                elif new_password != request.form.get("confirm_password", ""):
                    flash("New passwords do not match.", "danger")
                else:
                    db.execute("UPDATE users SET password_hash = ? WHERE id = ?",
                               (generate_password_hash(new_password), session["user_id"]))
                    db.commit()
                    flash("Password updated.", "success")
            else:
                days = request.form.getlist("laundry_days")
                valid_days = {"Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"}
                if any(day not in valid_days for day in days):
                    flash("Choose valid laundry days.", "danger")
                else:
                    db.execute("UPDATE users SET laundry_days = ? WHERE id = ?",
                               (",".join(dict.fromkeys(days)), session["user_id"]))
                    db.commit()
                    flash("Laundry schedule updated.", "success")
            return redirect(url_for("profile"))
        user = db.execute("SELECT laundry_days FROM users WHERE id = ?", (session["user_id"],)).fetchone()
        selected_days = user["laundry_days"].split(",") if user and user["laundry_days"] else ["Monday", "Thursday"]
        return render_template("profile.html", active_page="profile", selected_days=selected_days,
                               laundry_days=("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"))

    @app.errorhandler(413)
    def file_too_large(_error):
        flash("Images must be 5 MB or smaller.", "danger")
        return redirect(url_for("closet"))


def save_uploaded_image(upload, user_id: int) -> str | None | bool:
    if not upload or not upload.filename:
        return None
    filename = secure_filename(upload.filename)
    extension = Path(filename).suffix.lower()
    signatures = ALLOWED_IMAGE_SIGNATURES.get(extension)
    header = upload.stream.read(12)
    upload.stream.seek(0)
    valid = bool(signatures and any(header.startswith(signature) for signature in signatures))
    if extension == ".webp":
        valid = valid and header[8:12] == b"WEBP"
    if not valid:
        flash("Upload a valid PNG, JPEG, GIF, or WebP image.", "danger")
        return False
    key = secrets.token_hex(16) + extension
    user_dir = Path(current_app.config["UPLOAD_FOLDER"]) / str(user_id)
    user_dir.mkdir(parents=True, exist_ok=True)
    upload.save(user_dir / key)
    return key


def discard_uploaded_image(image_key: str | None | bool, user_id: int) -> None:
    if not image_key or image_key is False:
        return
    path = Path(current_app.config["UPLOAD_FOLDER"]) / str(user_id) / image_key
    try:
        path.unlink(missing_ok=True)
    except OSError:
        current_app.logger.exception("Could not remove an unused uploaded image")


app = create_app()


if __name__ == "__main__":
    app.run()
