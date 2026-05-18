import crypto from "crypto";
import { parseCookies } from "./security.js";

const COOKIE_NAME = "bev_owner";

function getSecret() {
  return process.env.OWNER_SESSION_SECRET || process.env.OWNER_PASSWORD || "change-me";
}

function sign(value) {
  return crypto.createHmac("sha256", getSecret()).update(value).digest("hex");
}

export function isOwnerConfigured() {
  return Boolean(process.env.OWNER_PASSWORD);
}

export function isOwnerAuthenticated(req) {
  const cookies = parseCookies(req.headers.cookie);
  const raw = cookies[COOKIE_NAME];
  if (!raw) return false;

  const [value, signature] = raw.split(".");
  if (!value || !signature) return false;

  const expected = sign(value);
  if (signature.length !== expected.length) return false;

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

export function setOwnerCookie(res) {
  const value = "owner";
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";

  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${encodeURIComponent(`${value}.${sign(value)}`)}; HttpOnly; SameSite=Lax; Path=/owner; Max-Age=86400${secure}`
  );
}

export function clearOwnerCookie(res) {
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/owner; Max-Age=0`
  );
}

export function requireOwner(req, res, next) {
  res.setHeader("Cache-Control", "no-store");
  if (isOwnerAuthenticated(req)) return next();
  return res.redirect("/owner/login");
}
