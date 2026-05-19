import crypto from "crypto";

const CSRF_COOKIE = "bev_csrf";
const ONE_HOUR = 60 * 60 * 1000;

// NOTE: This Map resets on every cold Vercel invocation — it only limits
// traffic within a single warm instance. For real brute-force protection
// replace with a persistent store (e.g. Upstash Redis).
const buckets = new Map();

function getSecret() {
  return process.env.OWNER_SESSION_SECRET || process.env.OWNER_PASSWORD || "change-me";
}

function sign(value) {
  return crypto.createHmac("sha256", getSecret()).update(value).digest("hex");
}

export function parseCookies(cookieHeader = "") {
  return Object.fromEntries(
    cookieHeader
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        return index === -1
          ? [part, ""]
          : [part.slice(0, index), safeDecode(part.slice(index + 1))];
      })
  );
}

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return "";
  }
}

function isSignedValueValid(raw) {
  const [value, signature] = String(raw || "").split(".");
  if (!value || !signature) return false;

  const expected = sign(value);
  if (signature.length !== expected.length) return false;

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

function getSignedValue(raw) {
  if (!isSignedValueValid(raw)) return null;
  return String(raw).split(".")[0];
}

function forbid(req, res, reason) {
  console.warn("Security block:", {
    reason,
    method: req.method,
    path: req.originalUrl || req.url,
    host: req.get("host") || "",
    originHost: safeHost(req.get("origin")),
    refererHost: safeHost(req.get("referer")),
  });

  return res.status(403).send("Forbidden");
}

function safeHost(value) {
  if (!value) return "";

  try {
    return new URL(value).host;
  } catch {
    return "";
  }
}

function isLoopbackHost(host = "") {
  const value = String(host).toLowerCase();
  const hostname = value.startsWith("[")
    ? value.slice(1, value.indexOf("]"))
    : value.split(":")[0];

  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function setCookie(res, name, value, options = {}) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  const httpOnly = options.httpOnly === false ? "" : "; HttpOnly";
  const maxAge = options.maxAge ? `; Max-Age=${options.maxAge}` : "";
  const sameSite = options.sameSite || "Lax";
  const path = options.path || "/";

  res.setHeader(
    "Set-Cookie",
    `${name}=${encodeURIComponent(value)}${httpOnly}; SameSite=${sameSite}; Path=${path}${maxAge}${secure}`
  );
}

export function ensureCsrfToken(req, res, next) {
  const cookies = parseCookies(req.headers.cookie);
  let token = getSignedValue(cookies[CSRF_COOKIE]);

  if (!token) {
    token = crypto.randomBytes(32).toString("base64url");
    setCookie(res, CSRF_COOKIE, `${token}.${sign(token)}`, {
      httpOnly: true,
      sameSite: "Lax",
      maxAge: 24 * 60 * 60,
    });
  }

  res.locals.csrfToken = `${token}.${sign(token)}`;
  next();
}

export function requireCsrf(req, res, next) {
  const cookies = parseCookies(req.headers.cookie);
  const cookieToken = getSignedValue(cookies[CSRF_COOKIE]);
  const bodyToken = String(req.body?._csrf || "");
  const signedBodyToken = getSignedValue(bodyToken);

  if (cookieToken && bodyToken === cookieToken) {
    return next();
  }

  if (!signedBodyToken) {
    return forbid(req, res, "csrf_missing_or_invalid");
  }

  if (cookieToken && cookieToken !== signedBodyToken) {
    return forbid(req, res, "csrf_cookie_mismatch");
  }

  next();
}

export function requireTrustedOrigin(req, res, next) {
  const unsafeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);
  if (!unsafeMethods.has(req.method)) return next();

  const origin = req.get("origin");
  const referer = req.get("referer");
  const host = req.get("host");

  // Browsers send the literal string "null" for opaque origins (file://, sandboxed
  // iframes, some privacy modes). Allow it in non-production so local dev isn't broken;
  // block it in production where a real, parseable origin is required.
  if (origin === "null") {
    if (process.env.NODE_ENV !== "production" || isLoopbackHost(host)) return next();
    return forbid(req, res, "origin_opaque");
  }

  const source = origin || referer || "";

  if (!source) return next();

  try {
    const sourceHost = new URL(source).host;

    if (host && sourceHost === host) return next();

    if (process.env.PUBLIC_URL && sourceHost === safeHost(process.env.PUBLIC_URL)) {
      return next();
    }
  } catch {
    return forbid(req, res, "origin_parse_failed");
  }

  return forbid(req, res, "origin_not_allowed");
}

export function rejectHoneypot(req, res, next) {
  if (req.body?.website) {
    return res.status(400).send("Bad request");
  }

  next();
}

export function rateLimit({ windowMs = ONE_HOUR, max = 60, keyPrefix = "global" } = {}) {
  return (req, res, next) => {
    const now = Date.now();
    const ip = req.ip || req.socket?.remoteAddress || "unknown";
    const key = `${keyPrefix}:${ip}`;
    const current = buckets.get(key);

    if (!current || current.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    current.count += 1;

    if (current.count > max) {
      return res.status(429).send("Too many requests. Please try again later.");
    }

    return next();
  };
}

export function timingSafeEqualText(a = "", b = "") {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

export function safeExternalUrl(value, allowedHosts = []) {
  if (!value) return undefined;

  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    const isAllowed = allowedHosts.some((allowed) => {
      const normalized = allowed.toLowerCase();
      return host === normalized || host.endsWith(`.${normalized}`);
    });

    return isAllowed ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

export function validateProductionConfig() {
  if (process.env.NODE_ENV !== "production") return;

  const weakOwnerPasswords = new Set(["bev12345", "password", "admin", "change-me"]);
  const ownerPassword = process.env.OWNER_PASSWORD || "";
  const ownerSecret = process.env.OWNER_SESSION_SECRET || "";

  if (!ownerPassword) {
    console.warn("OWNER_PASSWORD is not set. Owner gallery routes will remain unavailable.");
    return;
  }

  if (ownerPassword.length < 12 || weakOwnerPasswords.has(ownerPassword.toLowerCase())) {
    throw new Error("OWNER_PASSWORD must be strong before running in production.");
  }

  if (ownerSecret.length < 32 || ownerSecret === ownerPassword) {
    throw new Error("OWNER_SESSION_SECRET must be a separate random value of at least 32 characters.");
  }
}
