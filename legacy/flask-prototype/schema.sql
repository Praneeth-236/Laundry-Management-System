PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    username TEXT NOT NULL,
    username_key TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    laundry_days TEXT NOT NULL DEFAULT 'Monday,Thursday',
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    UNIQUE (user_id, name COLLATE NOCASE)
);

CREATE TABLE IF NOT EXISTS clothes (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    image_key TEXT,
    is_missing INTEGER NOT NULL DEFAULT 0 CHECK (is_missing IN (0, 1)),
    in_laundry INTEGER NOT NULL DEFAULT 0 CHECK (in_laundry IN (0, 1)),
    lost_date TEXT,
    last_washed TEXT,
    created_at TEXT NOT NULL,
    UNIQUE (user_id, name COLLATE NOCASE, category COLLATE NOCASE)
);

CREATE INDEX IF NOT EXISTS clothes_by_user_category ON clothes(user_id, category, name);
CREATE INDEX IF NOT EXISTS clothes_by_user_status ON clothes(user_id, is_missing, in_laundry);

CREATE TABLE IF NOT EXISTS laundry_history (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    cloth_id INTEGER NOT NULL REFERENCES clothes(id) ON DELETE CASCADE,
    sent_at TEXT NOT NULL,
    returned_at TEXT,
    status TEXT NOT NULL CHECK (status IN ('pending', 'returned', 'missing')),
    CHECK ((status = 'returned' AND returned_at IS NOT NULL) OR status != 'returned')
);

CREATE INDEX IF NOT EXISTS laundry_history_by_user ON laundry_history(user_id, sent_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS one_pending_laundry_record_per_item
    ON laundry_history(cloth_id) WHERE status = 'pending';
