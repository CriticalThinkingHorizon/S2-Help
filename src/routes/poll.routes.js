"use strict";

const express = require("express");
const { requireSameOrigin } = require("../security/origin");
const { createRateLimiter } = require("../security/rateLimit");
const { createSession, setSessionCookie } = require("../security/pollSession");
const {
  PollUnavailableError,
  PollNotFoundError,
  getStats
} = require("../services/poll.service");

const SLUG_RE = /^[a-z0-9-]{1,64}$/;

const sessionLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 300 });
const statsLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 1200 });

const router = express.Router();
const ipKey = function (req) { return req.ip || req.socket.remoteAddress || "unknown"; };

router.get("/poll-session", requireSameOrigin, sessionLimiter.middleware(ipKey), function (req, res) {
  const session = createSession();
  setSessionCookie(req, res, session.token);
  res.setHeader("Cache-Control", "no-store");
  res.json({ csrfToken: session.csrfToken, expiresAt: session.expiresAt });
});

router.get("/polls/:slug/stats", requireSameOrigin, statsLimiter.middleware(ipKey), async function (req, res) {
  if (!SLUG_RE.test(req.params.slug)) {
    res.status(404).json({ error: "Poll not found" });
    return;
  }

  try {
    const stats = await getStats(req.params.slug);
    res.setHeader("Cache-Control", "no-store");
    res.json(stats);
  } catch (error) {
    if (error instanceof PollNotFoundError) {
      res.status(404).json({ error: "Poll not found" });
      return;
    }
    if (error instanceof PollUnavailableError) {
      res.status(503).json({ error: "Poll analytics are temporarily unavailable" });
      return;
    }
    console.error("[Polls] Stats request failed:", error.message || error);
    res.status(500).json({ error: "Poll analytics are temporarily unavailable" });
  }
});

module.exports = router;
