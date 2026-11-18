"use strict";

const crypto = require("crypto");
const { POLL_SESSION_SECRET } = require("../config");

const COOKIE_NAME = "s2_poll_session";
const SESSION_TTL_MS = 60 * 60 * 1000;

function hmac(value) {
  return crypto.createHmac("sha256", POLL_SESSION_SECRET).update(value).digest("base64url");
}

function csrfFor(sessionId) {
  return crypto
    .createHmac("sha256", POLL_SESSION_SECRET + ":csrf")
    .update(sessionId)
    .digest("base64url");
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function createSession() {
  const sessionId = crypto.randomUUID();
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const payload = sessionId + "." + expiresAt;
  return {
    token: payload + "." + hmac(payload),
    csrfToken: csrfFor(sessionId),
    expiresAt
  };
}

function verifySessionToken(token) {
  if (typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const sessionId = parts[0];
  const expiresAt = Number(parts[1]);
  if (!sessionId || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;
  if (!safeEqual(parts[2], hmac(sessionId + "." + parts[1]))) return null;

  return {
    sessionId,
    expiresAt,
    csrfToken: csrfFor(sessionId)
  };
}

function parseCookies(header) {
  const cookies = {};
  if (typeof header !== "string" || !header) return cookies;
  header.split(";").forEach(function (part) {
    const index = part.indexOf("=");
    if (index < 0) return;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (!key) return;
    try {
      cookies[key] = decodeURIComponent(value);
    } catch (error) {
      cookies[key] = value;
    }
  });
  return cookies;
}

function getSessionCookie(header) {
  return parseCookies(header)[COOKIE_NAME] || null;
}

function validateSocketSession(socket) {
  const session = verifySessionToken(getSessionCookie(socket.handshake.headers.cookie));
  if (!session) return null;
  const provided = socket.handshake.auth && socket.handshake.auth.csrfToken;
  if (!safeEqual(provided, session.csrfToken)) return null;
  return session;
}

function setSessionCookie(req, res, token) {
  const secure = req.secure || req.headers["x-forwarded-proto"] === "https";
  const attributes = [
    COOKIE_NAME + "=" + encodeURIComponent(token),
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    "Max-Age=" + Math.floor(SESSION_TTL_MS / 1000)
  ];
  if (secure) attributes.push("Secure");
  res.setHeader("Set-Cookie", attributes.join("; "));
}

module.exports = {
  COOKIE_NAME,
  SESSION_TTL_MS,
  createSession,
  verifySessionToken,
  getSessionCookie,
  validateSocketSession,
  setSessionCookie
};
