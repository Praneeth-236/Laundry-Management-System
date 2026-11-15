# Database and data model

Washday uses MongoDB through Mongoose. A document is a JSON-like record stored in a collection. Mongoose schemas define the fields the application expects; MongoDB indexes enforce important uniqueness and lookup rules.

## Relationship view

```mermaid
erDiagram
    USER ||--o{ CLOTHING_ITEM : owns
    USER ||--o{ LAUNDRY_EVENT : records
    CLOTHING_ITEM ||--o{ LAUNDRY_EVENT : appears_in
    USER {
        ObjectId _id
        string username
        string usernameNormalized
        string passwordHash
        string[] laundryDays
        string[] categories
    }
    CLOTHING_ITEM {
        ObjectId _id
        ObjectId owner
        string name
        string category
        string status
        string photoKey
        date lostAt
        date lastWashedAt
        date archivedAt
    }
    LAUNDRY_EVENT {
        ObjectId _id
        ObjectId owner
        ObjectId item
        date sentAt
        date returnedAt
        string status
    }
```

The actual schemas are in `server/src/models/`. The event collection is separate because a clothing item can have many laundry cycles over time. A reference from an event to an item avoids copying names into every history event; the history view populates the current item name and category.

## User document

`User` holds account identity, the bcrypt password hash, selected laundry weekdays, and custom categories. `usernameNormalized` is lowercased for case-insensitive login. `passwordHash` is marked `select: false`, so normal user queries do not return it accidentally. Sign-in explicitly requests it.

The `usernameNormalized` unique index ensures two concurrent account-creation requests cannot claim the same username. Application checks provide a friendly error; the database index is the final authority.

## Clothing item document

`ClothingItem` has an `owner` ObjectId and a small state machine:

```text
available -> in_laundry -> available
available -> missing -> available
in_laundry -> missing
```

`archivedAt` is a soft-delete timestamp. Archiving hides the item from the active closet while retaining its laundry events. An item in laundry cannot be archived, which prevents the return flow from losing its item record.

The compound owner/name/category index uses a case-insensitive collation. A user can have similarly named clothes in different categories, while a duplicate name in the same category is rejected.

## Laundry event document

An event belongs to one owner and one item. Its state changes from `pending` to `returned` or `missing`. `sentAt` and `returnedAt` provide an audit trail that does not depend on the current item status.

The partial unique index on `item` applies only while `status` is `pending`. Completed history rows may repeat an item; only one active laundry event is allowed for it. This protects the invariant even if two web requests race.

## Why updates use transactions

Sending an item writes two collections: create a pending event and change the item's status. Returning it also changes both. Without a transaction, a process crash between writes could leave the event and item disagreeing.

`server/src/utils/transactions.js` wraps both writes in a MongoDB transaction. The same session object is passed to every Mongoose query in the transaction. If a validation, unique-index, or state check fails, MongoDB aborts all writes. A replica set is needed even for a one-node local database; the setup is in `docker-compose.yml` and `scripts/init-mongo-replica.js`.

## Session documents

`connect-mongo` writes login sessions to the `sessions` collection. The browser only receives a signed session identifier in an HTTP-only cookie. Session data itself is not stored in browser local storage.

## Query and index choices

- `User.usernameNormalized`: unique account lookup.
- `ClothingItem(owner, archivedAt, category, name)`: owner-scoped active inventory listing.
- `ClothingItem(owner, name, category)` with case-insensitive collation: duplicate prevention.
- `LaundryEvent(item)` partial unique for pending events: one active cycle per item.
- `LaundryEvent(owner, sentAt desc)`: owner history in newest-first order.

MongoDB aggregation groups clothing counts for the dashboard. Laundry history uses `populate` to read item name/category for display.

## Data operations still needed

Mongoose creates indexes at application startup in this project, but there is no versioned schema migration framework yet. Before collecting real user data, add migration scripts for schema evolution and rehearse backup/restore. For a multi-instance deployment, move image files from local disk to private object storage and keep database backups outside the application container.
