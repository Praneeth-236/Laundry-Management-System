# Interview preparation

Use this as practice, not a script to memorize. Explain the behavior in your own words, point to the code, and be clear about what is implemented versus planned.

## A 60-90 second project introduction

> I built Washday, a laundry tracker for hostel residents and shared homes. The frontend is React with Vite, and the backend is an Express API on Node. MongoDB stores users, clothing items, laundry events, and sessions through Mongoose. People can organize their clothes, set laundry days, track items through a wash cycle, and report something missing. I focused on ownership checks, server-side sessions, CSRF protection, and transactions so an item status and its laundry history do not get out of sync. I started with a C command-line prototype, then rebuilt the active web app in MERN to learn the full browser-to-database flow. I added unit and API integration checks plus a CI workflow; this is still a learning project, with production operations, account recovery, object storage, and shared-machine booking left to build.

Say the last sentence honestly. It demonstrates engineering judgment instead of overclaiming production readiness.

## Questions you should be able to answer

### Architecture and stack

**1. What does MERN stand for?**

MongoDB, Express, React, and Node.js. MongoDB is the database; Express and Node handle HTTP requests; React renders the browser UI.

**2. Walk me through a request.**

The page calls `client/src/api.js`; Vite proxies `/api` to Express in development; Express middleware checks session and CSRF; a route calls a controller; the controller uses a Mongoose model; the result returns as JSON and React updates state.

**3. Why separate routes from controllers?**

Routes map HTTP paths/methods to functions and middleware. Controllers implement the feature behavior. This keeps URL wiring separate from business rules.

**4. What does middleware do?**

It runs between the incoming request and final route response. Washday uses middleware for security headers, JSON parsing, sessions, CSRF, authentication, and async error forwarding.

**5. Why does the app use Vite?**

Vite serves the React app quickly during development, supports module hot updates, and builds static production assets. The proxy makes browser API calls same-origin while developing.

### React and browser behavior

**6. What is React state?**

Data a component owns that can change over time. For example, selected laundry IDs and a search term are state. Updating state causes React to render the UI with the new value.

**7. What is `useEffect` used for here?**

Loading server data when a page opens. It synchronizes the page with the API. It is not needed for simple derived values like filtering; that is calculated from existing state.

**8. What is `useMemo` doing in the closet?**

It derives the filtered visible list from all items, current search, and selected category. The source inventory stays the source of truth.

**9. Why have an `AuthContext`?**

Several pages need the signed-in user and account actions. Context shares that state without passing the same props through every layout component.

**10. Can React protect a route by itself?**

No. `ProtectedRoute` improves navigation, but Express must authenticate every private API call. A user can call the API without rendering the React page.

### Express, validation, and API design

**11. What does `next()` mean in Express?**

It passes control to the next middleware. Calling `next(error)` skips normal handlers and routes the failure to error middleware.

**12. Where is input validated?**

In the Express controller with Zod, then again through Mongoose schema validation at persistence. Browser constraints are for usability, not trust.

**13. Why use HTTP status codes?**

They let clients distinguish outcomes. Washday uses 400 for invalid input, 401 for unauthenticated requests, 403 for CSRF failure, 409 for state conflicts, and 500 for unexpected server failures.

**14. Why return a generic 500 message?**

Internal stack traces and database details should stay in server logs. The browser gets a safe message and a stable error code.

### Database and correctness

**15. Why MongoDB for this project?**

The project is a MERN learning goal and its records map naturally to user, clothing, and event documents. MongoDB also gives practice with indexes, references, aggregation, and transactions.

**16. Why reference laundry events instead of embedding the full history in each clothing document?**

History grows over time and deserves its own query/index path. Separate event documents can be paginated and retained independently. The tradeoff is that updates spanning an item and event need a transaction.

**17. Why is a transaction needed?**

Sending to laundry writes a pending event and changes the item's status. Those changes represent one logical operation. A transaction prevents only one of the two writes from committing.

**18. Why configure a replica set locally?**

MongoDB transactions require replica-set or sharded-cluster support. A one-node replica set gives the same transaction capability during local learning; it is not high availability.

**19. What is the partial unique index for?**

It permits only one laundry event with `status: pending` for a clothing item. Completed events can repeat. The index handles concurrent requests more reliably than a check in application code alone.

**20. What is an aggregation pipeline used for?**

The dashboard groups active clothing by status and counts each group in MongoDB rather than loading every clothing record into Node just to count it.

### Security

**21. Why server-side sessions instead of JWTs?**

This app is a same-origin browser application. Sessions are easy to revoke centrally and are stored in MongoDB; the browser gets only an HTTP-only cookie. JWTs can help with distributed APIs but bring token expiry, refresh, and revocation tradeoffs.

**22. What is CSRF and how do you reduce it?**

Cross-site request forgery tricks a browser into sending an authenticated request. Washday uses SameSite cookies and a random synchronizer token in a custom header on state-changing requests.

**23. Why bcrypt?**

It is a password-hashing function with a configurable work factor, unlike plain SHA-256. Hashing is intentionally expensive so a leaked database is harder to brute-force offline.

**24. How do you prevent one user from reading another user's item?**

Private API queries include the owner ID from the server-side session as well as the record ID. The record ID alone never grants access.

**25. How are photo uploads protected?**

The server limits size, checks extension/MIME/signature, generates its own filename, stores files outside the public static directory, and checks account ownership before serving a photo.

**26. How does the login rate limit work across multiple API instances?**

`express-rate-limit` delegates counting to a custom MongoDB store. Each IP gets one fixed-window counter document. Atomic `$inc` updates prevent concurrent requests from overwriting each other's counts, and a unique document ID plus retries handle concurrent first requests and expired-window resets. The API checks the counter's reset time itself; a MongoDB TTL index eventually removes old counters. CI tests two independent store instances against the same replica set. This shares state, but authentication still depends on MongoDB availability and should be monitored.

**27. What is still missing before production?**

The current unit and API integration suites run in CI, including upload boundaries, concurrency, and the shared rate-limit store. Users can export their account data and permanently delete their account after password confirmation; deletion removes owned records and all account sessions in a MongoDB transaction, then deletes stored photos. Account recovery, time-zone support, private photo storage/retention, migrations, backup/restore, monitoring, and a deployment/security review remain before real users.

### Project history and tradeoffs

**28. Why move from C/Flask to MERN?**

The C CLI was the original learning prototype. Flask wrapped it as a subprocess with flat-file persistence. I chose MERN for the active rebuild because I wanted to learn modern browser, API, session, and MongoDB transaction patterns and explain a single coherent web stack.

**29. Is the C program still part of the production web path?**

No. It is preserved as a historical standalone prototype under `legacy/c-prototype/`. The MERN app does not invoke it.

**30. Why are uploads on local disk?**

It is simple for local development and a single server. It does not suit multiple ephemeral app instances; object storage is a release requirement before scaling.

**31. How would you scale a hostel version?**

Add hostel/workspace membership, machine and reservation models, conflict-safe queue rules, private object storage, managed MongoDB, and observability. Then test concurrency and fairness explicitly.

## Code locations to open while answering

| Topic | Files |
| --- | --- |
| React route and layout | `client/src/App.jsx`, `client/src/components/AppShell.jsx` |
| Browser API and CSRF header | `client/src/api.js`, `server/src/middleware/csrf.js` |
| Login and sessions | `client/src/context/AuthContext.jsx`, `server/src/controllers/authController.js`, `server/src/app.js` |
| Shared login rate limit | `server/src/routes/authRoutes.js`, `server/src/middleware/mongoRateLimitStore.js`, `server/src/config/database.js` |
| Clothing ownership | `server/src/controllers/clothingController.js`, `server/src/models/ClothingItem.js` |
| Laundry transaction | `server/src/controllers/laundryController.js`, `server/src/utils/transactions.js`, `server/src/models/LaundryEvent.js` |
| Environment and database | `server/src/config/env.js`, `server/src/config/database.js` |
| MongoDB local setup | `docker-compose.yml`, `scripts/init-mongo-replica.js` |

## A truthful resume bullet

> Rebuilt a C/Flask laundry tracker as a MERN application with React inventory workflows, Express session authentication, MongoDB ownership-scoped data, CSRF protection, and transactional laundry status/history updates; documented local replica-set development and the security/deployment roadmap.

Do not add claims about users, uptime, testing, deployment, or shared-machine reservations until you have actually delivered them.
