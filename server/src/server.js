import { app } from "./app.js";
import { closeDatabase, connectDatabase } from "./config/database.js";
import { env } from "./config/env.js";

await connectDatabase();
const server = app.listen(env.PORT, () => {
  console.info(`Laundry API listening on http://localhost:${env.PORT}`);
});

let isClosing = false;
async function shutdown(signal) {
  if (isClosing) return;
  isClosing = true;
  console.info(`${signal} received; closing the server.`);
  server.close(async (error) => {
    const results = await Promise.allSettled([closeDatabase(), app.locals.sessionStore.close()]);
    const failure = results.find((result) => result.status === "rejected");
    if (error || failure) {
      console.error("Server shutdown failed:", error ?? failure.reason);
      process.exitCode = 1;
    }
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
