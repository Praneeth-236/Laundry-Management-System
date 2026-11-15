let csrfToken = "";

export class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export async function refreshCsrfToken() {
  const response = await fetch("/api/auth/csrf", { credentials: "include" });
  if (!response.ok) throw new ApiError("Could not start a secure session.", response.status, "CSRF_SETUP_FAILED");
  const data = await response.json();
  csrfToken = data.csrfToken;
}

async function request(path, options = {}, canRetry = true) {
  const method = (options.method ?? "GET").toUpperCase();
  const changesState = !["GET", "HEAD", "OPTIONS"].includes(method);
  if (changesState && !csrfToken) await refreshCsrfToken();

  const headers = new Headers(options.headers ?? {});
  let body = options.body;
  if (body && !(body instanceof FormData) && typeof body !== "string") {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(body);
  }
  if (changesState) headers.set("X-CSRF-Token", csrfToken);

  const response = await fetch(`/api${path}`, {
    ...options,
    method,
    headers,
    body,
    credentials: "include",
  });
  const data = response.status === 204 ? null : await response.json().catch(() => ({}));

  if (!response.ok && response.status === 403 && canRetry && data?.error?.code?.startsWith("CSRF_TOKEN")) {
    csrfToken = "";
    await refreshCsrfToken();
    return request(path, options, false);
  }
  if (!response.ok) {
    throw new ApiError(data?.error?.message ?? "The request could not be completed.", response.status, data?.error?.code);
  }
  return data;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: "POST", body }),
  patch: (path, body) => request(path, { method: "PATCH", body }),
  delete: (path, body) => request(path, { method: "DELETE", body }),
};
