"use strict";

const { TRUST_PROXY } = require("../config");
const { validateSocketSession } = require("../security/pollSession");
const { hashDeviceId } = require("../security/deviceId");
const { createRateLimiter } = require("../security/rateLimit");
const {
  ValidationError,
  submitPayloadSchema,
  statusPayloadSchema
} = require("../polls/validation");
const {
  PollUnavailableError,
  PollNotFoundError,
  getStats,
  getReport,
  submitResponse,
  undoResponse
} = require("../services/poll.service");

const actionLimiter = createRateLimiter({ windowMs: 5 * 60 * 1000, max: 5 });
const ipLimiter = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 10 });

function getClientIp(socket) {
  if (TRUST_PROXY) {
    const forwarded = socket.handshake.headers["x-forwarded-for"];
    if (typeof forwarded === "string" && forwarded) {
      return forwarded.split(",")[0].trim();
    }
  }
  return socket.handshake.address || "unknown";
}

function acknowledge(ack, payload) {
  if (typeof ack === "function") ack(payload);
}

function reject(ack, message) {
  acknowledge(ack, { ok: false, error: message });
}

function sessionStillValid(socket) {
  const session = socket.data.pollSession;
  return session && session.expiresAt > Date.now();
}

async function handleError(error, ack) {
  if (error instanceof ValidationError) {
    reject(ack, "Invalid request");
    return;
  }
  if (error instanceof PollNotFoundError) {
    reject(ack, "Poll not found");
    return;
  }
  if (error instanceof PollUnavailableError) {
    reject(ack, "Poll analytics are temporarily unavailable");
    return;
  }
  console.error("[Polls] Socket request failed:", error.message || error);
  reject(ack, "Poll analytics are temporarily unavailable");
}

async function statsFor(namespace, slug) {
  const stats = await getStats(slug);
  namespace.emit("poll:stats", { slug, stats });
  return stats;
}

function registerPollSocket(io) {
  const polls = io.of("/polls");

  polls.use(function (socket, next) {
    const session = validateSocketSession(socket);
    if (!session) {
      next(new Error("unauthorized"));
      return;
    }
    socket.data.pollSession = session;
    next();
  });

  polls.on("connection", function (socket) {
    const socketLimiter = createRateLimiter({ windowMs: 10 * 1000, max: 30 });

    function prepare(ack) {
      if (!socketLimiter.take("events")) {
        reject(ack, "Too many requests");
        return false;
      }
      if (!sessionStillValid(socket)) {
        reject(ack, "Session expired");
        socket.disconnect(true);
        return false;
      }
      return true;
    }

    socket.on("poll:status", async function (payload, ack) {
      if (!prepare(ack)) return;
      const parsed = statusPayloadSchema.safeParse(payload);
      if (!parsed.success) {
        reject(ack, "Invalid request");
        return;
      }

      try {
        const deviceHash = hashDeviceId(parsed.data.deviceId);
        const [report, stats] = await Promise.all([
          getReport(parsed.data.slug, deviceHash),
          getStats(parsed.data.slug)
        ]);
        acknowledge(ack, { ok: true, report, stats });
      } catch (error) {
        await handleError(error, ack);
      }
    });

    socket.on("poll:submit", async function (payload, ack) {
      if (!prepare(ack)) return;
      const parsed = submitPayloadSchema.safeParse(payload);
      if (!parsed.success) {
        reject(ack, "Invalid request");
        return;
      }

      const deviceHash = hashDeviceId(parsed.data.deviceId);
      if (!actionLimiter.take("device:" + deviceHash)) {
        reject(ack, "Too many requests");
        return;
      }
      if (!ipLimiter.take("ip:" + getClientIp(socket))) {
        reject(ack, "Too many requests");
        return;
      }

      try {
        const result = await submitResponse(parsed.data.slug, deviceHash, parsed.data.answers);
        let stats = null;
        try {
          stats = await statsFor(polls, parsed.data.slug);
        } catch (error) {
          console.error("[Polls] Failed to refresh stats:", error.message || error);
        }
        acknowledge(ack, {
          ok: true,
          created: result.created,
          report: result.report,
          stats
        });
      } catch (error) {
        await handleError(error, ack);
      }
    });

    socket.on("poll:undo", async function (payload, ack) {
      if (!prepare(ack)) return;
      const parsed = statusPayloadSchema.safeParse(payload);
      if (!parsed.success) {
        reject(ack, "Invalid request");
        return;
      }

      const deviceHash = hashDeviceId(parsed.data.deviceId);
      if (!actionLimiter.take("device:" + deviceHash)) {
        reject(ack, "Too many requests");
        return;
      }
      if (!ipLimiter.take("ip:" + getClientIp(socket))) {
        reject(ack, "Too many requests");
        return;
      }

      try {
        const removed = await undoResponse(parsed.data.slug, deviceHash);
        let stats = null;
        try {
          stats = await statsFor(polls, parsed.data.slug);
        } catch (error) {
          console.error("[Polls] Failed to refresh stats:", error.message || error);
        }
        acknowledge(ack, { ok: true, removed, stats });
      } catch (error) {
        await handleError(error, ack);
      }
    });
  });
}

module.exports = {
  registerPollSocket
};
