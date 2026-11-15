import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";

export function requestContext(req, res, next) {
  const requestId = randomUUID();
  const startedAt = performance.now();
  req.requestId = requestId;
  res.setHeader("X-Request-ID", requestId);
  res.on("finish", () => {
    const status = res.statusCode;
    const level = status >= 500 ? "error" : status >= 400 ? "warn" : "info";
    console[level](JSON.stringify({
      level,
      event: "http_request",
      requestId,
      method: req.method,
      path: req.path,
      status,
      durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
    }));
  });
  next();
}
