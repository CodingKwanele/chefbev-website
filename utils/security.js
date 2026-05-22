import crypto from "crypto";

const CSRF_COOKIE = "bev_csrf";
const ONE_HOUR = 60 * 60 * 1000;

// NOTE: This Map resets on every cold Vercel invocation — it only limits
// traffic within a single warm instance when Upstash Redis is not configured.
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
    forwardedHost: req.get("x-forwarded-host") || "",
    vercelForwardedHost: req.get("x-vercel-forwarded-for-host") || "",
    originHost: safeHost(req.get("origin")),
    refererHost: safeHost(req.get("referer")),
    publicUrlHost: safeHostWithOptionalProtocol(process.env.PUBLIC_URL),
    vercelUrlHost: safeHostWithOptionalProtocol(process.env.VERCEL_URL),
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

function safeHostWithOptionalProtocol(value) {
  if (!value) return "";
  const raw = String(value).trim();
  const url = raw.includes("://") ? raw : `https://${raw}`;
  return safeHost(url);
}

function addHost(hosts, value) {
  const host = String(value || "").trim().toLowerCase();
  if (host) hosts.add(host);
}

function addForwardedHosts(hosts, value) {
  String(value || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .forEach((host) => addHost(hosts, host));
}

function getTrustedHosts(req) {
  const hosts = new Set();

  addHost(hosts, req.get("host"));
  addForwardedHosts(hosts, req.get("x-forwarded-host"));
  addForwardedHosts(hosts, req.get("x-vercel-forwarded-for-host"));
  addHost(hosts, safeHostWithOptionalProtocol(process.env.PUBLIC_URL));
  addHost(hosts, safeHostWithOptionalProtocol(process.env.VERCEL_URL));

  return hosts;
}

function isLoopbackHost(host = "") {
  const value = String(host).toLowerCase();
  const hostname = value.startsWith("[")
    ? value.slice(1, value.indexOf("]"))
    : value.split(":")[0];

  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function getClientIp(req) {
  const forwardedFor = req.get("x-forwarded-for") || "";
  const firstForwardedIp = forwardedFor.split(",")[0]?.trim();
  return firstForwardedIp || req.ip || req.socket?.remoteAddress || "unknown";
}

function rateLimitIdentity(req) {
  return crypto
    .createHmac("sha256", getSecret())
    .update(getClientIp(req))
    .digest("hex")
    .slice(0, 32);
}

function isRedisRateLimitConfigured() {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

async function upstashPipeline(commands) {
  const url = `${process.env.UPSTASH_REDIS_REST_URL.replace(/\/$/, "")}/pipeline`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(commands),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Upstash rate limit request failed with HTTP ${response.status}`);
    }

    const result = await response.json();
    if (!Array.isArray(result)) {
      throw new Error("Upstash rate limit response was not an array.");
    }

    const failed = result.find((entry) => entry?.error);
    if (failed) {
      throw new Error(failed.error);
    }

    return result.map((entry) => entry.result);
  } finally {
    clearTimeout(timeout);
  }
}

async function redisRateLimit({ key, windowMs, max }) {
  const windowSeconds = Math.ceil(windowMs / 1000);
  const [count, , ttl] = await upstashPipeline([
    ["INCR", key],
    ["EXPIRE", key, windowSeconds, "NX"],
    ["TTL", key],
  ]);

  return {
    limited: Number(count) > max,
    count: Number(count),
    retryAfterSeconds: Number(ttl) > 0 ? Number(ttl) : windowSeconds,
  };
}

function memoryRateLimit({ key, windowMs, max }) {
  const now = Date.now();
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { limited: false, count: 1, retryAfterSeconds: Math.ceil(windowMs / 1000) };
  }

  current.count += 1;

  return {
    limited: current.count > max,
    count: current.count,
    retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
  };
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
  const trustedHosts = getTrustedHosts(req);

  // Browsers send the literal string "null" for opaque origins (file://, sandboxed
  // iframes, some privacy modes). Let these continue to the CSRF check instead
  // of blocking valid form submissions from privacy-sensitive browsers.
  if (origin === "null") {
    return next();
  }

  const source = origin || referer || "";

  if (!source) return next();

  try {
    const sourceHost = new URL(source).host.toLowerCase();
    if (trustedHosts.has(sourceHost)) return next();
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
  return async (req, res, next) => {
    const identity = rateLimitIdentity(req);
    const key = `ratelimit:${keyPrefix}:${identity}`;

    try {
      const result = isRedisRateLimitConfigured()
        ? await redisRateLimit({ key, windowMs, max })
        : memoryRateLimit({ key, windowMs, max });

      res.setHeader("X-RateLimit-Limit", String(max));
      res.setHeader("X-RateLimit-Remaining", String(Math.max(0, max - result.count)));

      if (!result.limited) return next();

      res.setHeader("Retry-After", String(result.retryAfterSeconds));
      return res.status(429).send("Too many requests. Please try again later.");
    } catch (err) {
      console.error("Rate limit check failed:", {
        keyPrefix,
        message: err.message,
      });

      return next();
    }
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
