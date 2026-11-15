import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const envModule = new URL("../src/config/env.js", import.meta.url).href;
const baseEnvironment = {
  ...process.env,
  NODE_ENV: "production",
  SESSION_SECRET: "test-production-session-secret-0123456789",
  MONGODB_URI: "mongodb://127.0.0.1:27017/washday?replicaSet=rs0",
};
const importEnvironment = `import { env } from ${JSON.stringify(envModule)}; process.stdout.write(env.PUBLIC_APP_URL);`;

test("production config requires HTTPS for recovery links", () => {
  const environment = { ...baseEnvironment, PUBLIC_APP_URL: "http://localhost:5173" };
  assert.throws(() => execFileSync(process.execPath, ["--input-type=module", "--eval", importEnvironment], {
    env: environment,
    encoding: "utf8",
    stdio: "pipe",
  }), (error) => {
    assert.equal(error.status, 1);
    assert.match(error.stderr.toString(), /PUBLIC_APP_URL must use HTTPS in production/);
    return true;
  });
});

test("production config accepts the deployed HTTPS application URL", () => {
  const output = execFileSync(process.execPath, ["--input-type=module", "--eval", importEnvironment], {
    env: { ...baseEnvironment, PUBLIC_APP_URL: "https://washday-demo.onrender.com" },
    encoding: "utf8",
    cwd: fileURLToPath(new URL("..", import.meta.url)),
  });
  assert.equal(output, "https://washday-demo.onrender.com");
});
