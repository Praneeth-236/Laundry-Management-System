# API reference

The API is JSON under `/api`. During development, Vite proxies this prefix to Express. In a production build, Express serves the same API and React files from one origin.

## Shared rules

- Private routes require the session cookie created by the API.
- Every `POST`, `PATCH`, and `DELETE` request must include `X-CSRF-Token`.
- Get the token from `GET /api/auth/csrf`. The browser API helper does this automatically.
- IDs are MongoDB ObjectIds represented as 24-character hexadecimal strings.
- Error responses have the shape `{ "error": { "code": "...", "message": "..." } }`.
- Responses include an `X-Request-ID` header. Error responses also include that ID as `error.requestId`; share it when reporting a failure.
- Input is validated on the server. Browser-side constraints improve feedback but are not trusted for security.

## Authentication

| Method | Path | Login required | Purpose |
| --- | --- | --- | --- |
| GET | `/api/auth/csrf` | No | Create/return this browser session's CSRF token |
| GET | `/api/auth/me` | No | Return `{ user }`; `user` is `null` when signed out |
| POST | `/api/auth/register` | No | Create an account and sign it in |
| POST | `/api/auth/login` | No | Verify credentials and rotate the session ID |
| POST | `/api/auth/logout` | No | Destroy the session and clear its cookie |

Register and login accept `{ "username": "sam_1", "password": "a long passphrase" }`. Usernames are 3-20 letters, numbers, or underscores. Passwords are 12-72 characters and no more than 72 UTF-8 bytes for bcrypt compatibility. Repeated attempts are rate limited by IP.

Example current-user response:

```json
{
  "user": {
    "id": "6655ab...",
    "username": "sam_1",
    "laundryDays": ["Monday", "Thursday"],
    "categories": []
  }
}
```

## Clothing

All clothing routes require login.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/clothes` | List active clothing and categories |
| POST | `/api/clothes` | Create a clothing item; multipart form data, optional `photo` |
| POST | `/api/clothes/categories` | Add a custom category with `{ "name": "Sportswear" }` |
| GET | `/api/clothes/:itemId/photo` | Stream the private photo after checking ownership |
| POST | `/api/clothes/:itemId/missing` | Mark an available item missing |
| POST | `/api/clothes/:itemId/found` | Mark a missing item found |
| DELETE | `/api/clothes/:itemId` | Archive an item, remove its photo, and retain laundry history |

`GET /api/clothes` accepts optional `search` and exact `category` query parameters. Its response includes `{ items, categories }`. Clothing creation fields are `name`, `category`, and optional image file field `photo`. The file limit is 5 MB; accepted formats are PNG, JPEG, GIF, and WebP. Each account can upload up to 30 photos per 24 hours; the API returns `429 PHOTO_UPLOAD_LIMIT` when the quota is reached.

## Dashboard

`GET /api/dashboard/stats` requires login and returns:

```json
{
  "stats": { "total": 12, "available": 8, "inLaundry": 3, "missing": 1 }
}
```

## Laundry

All laundry routes require login.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/laundry` | Return schedule, current weekday, available items, and latest 100 events |
| POST | `/api/laundry` | Create a cycle for 1-100 selected item IDs |
| POST | `/api/laundry/:eventId/return` | Mark a pending item returned |
| POST | `/api/laundry/:eventId/missing` | Mark a pending item missing from laundry |

Start a cycle with `{ "itemIds": ["6655ab...", "6655cd..."] }`. The API rejects duplicates, stale IDs, items belonging to another account, items already missing/in laundry, and attempts outside that account's allowed weekday. Each selected item receives one laundry-event record and changes to `in_laundry` in a MongoDB transaction.

`GET /api/laundry` returns `{ laundryDays, currentDay, canSubmit, availableItems, history }`. Each history event includes its item name/category when that item still exists.

## Profile

All profile routes require login.

| Method | Path | Purpose |
| --- | --- | --- |
| PATCH | `/api/profile/schedule` | Replace allowed days with `{ "laundryDays": ["Monday", "Thursday"] }` |
| PATCH | `/api/profile/password` | Change password with `currentPassword`, `newPassword`, `confirmPassword` |
| GET | `/api/profile/export` | Download account, clothing, and laundry history as private JSON |
| DELETE | `/api/profile/account` | Permanently delete account data and photos after confirming `currentPassword` |

An empty `laundryDays` array means laundry cannot be sent on any weekday until the schedule is changed.
The export is a point-in-time copy and excludes photo contents. Account deletion is irreversible; the server verifies the current password, deletes owned records and all account sessions in a MongoDB transaction, then removes photo files.

## Health and errors

`GET /api/health` is public and reports whether Express can see the Mongoose connection. A disconnected database returns HTTP 503.

Common status codes:

| Status | Meaning |
| --- | --- |
| 400 | Invalid input or request body |
| 401 | Login is required or credentials are invalid |
| 403 | CSRF token is missing or invalid |
| 404 | Route or owner-scoped record was not found |
| 409 | State conflict, duplicate record, or schedule is closed |
| 413 | Uploaded file exceeds the size limit |
| 429 | Too many sign-in attempts |
| 500 | Unexpected server error; details stay in server logs |
