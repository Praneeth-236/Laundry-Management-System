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
const inspectEnvironment = `import { env } from ${JSON.stringify(envModule)}; process.stdout.write(JSON.stringify(env));`;

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

test("demo mode permits intentionally limited demo integrations", () => {
  const output = execFileSync(process.execPath, ["--input-type=module", "--eval", inspectEnvironment], {
    env: { ...baseEnvironment, DEPLOYMENT_MODE: "demo", PUBLIC_APP_URL: "https://washday-demo.onrender.com" },
    encoding: "utf8",
    cwd: fileURLToPath(new URL("..", import.meta.url)),
  });
  assert.equal(JSON.parse(output).DEPLOYMENT_MODE, "demo");
});

test("production deployment rejects demo-only storage and service configuration", () => {
  const environment = { ...baseEnvironment, DEPLOYMENT_MODE: "production", PUBLIC_APP_URL: "https://washday.example" };
  assert.throws(() => execFileSync(process.execPath, ["--input-type=module", "--eval", inspectEnvironment], {
    env: environment,
    encoding: "utf8",
    stdio: "pipe",
  }), (error) => {
    assert.equal(error.status, 1);
    const stderr = error.stderr.toString();
    assert.match(stderr, /Production deployment requires private S3-compatible photo storage/);
    assert.match(stderr, /SMTP_HOST and SMTP_FROM are required/);
    assert.match(stderr, /MongoDB URI must enable TLS/);
    return true;
  });
});

test("production deployment accepts TLS MongoDB, private storage, SMTP, and HTTPS", () => {
  const environment = {
    ...baseEnvironment,
    DEPLOYMENT_MODE: "production",
    MONGODB_URI: "mongodb+srv://db.example.test/washday",
    PUBLIC_APP_URL: "https://washday.example",
    PHOTO_STORAGE_DRIVER: "s3",
    S3_ENDPOINT: "https://account.r2.cloudflarestorage.com",
    S3_BUCKET: "washday-private",
    S3_ACCESS_KEY_ID: "test-access-key",
    S3_SECRET_ACCESS_KEY: "test-secret-key",
    SMTP_HOST: "smtp.example.test",
    SMTP_FROM: "no-reply@washday.example",
  };
  const output = execFileSync(process.execPath, ["--input-type=module", "--eval", inspectEnvironment], {
    env: environment,
    encoding: "utf8",
    cwd: fileURLToPath(new URL("..", import.meta.url)),
  });
  assert.equal(JSON.parse(output).DEPLOYMENT_MODE, "production");
});
