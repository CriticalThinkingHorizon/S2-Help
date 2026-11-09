"use strict";

const { getStats, increment } = require("../services/faqStats.service");

const RATE_WINDOW_MS = 10000;
const RATE_MAX_EVENTS = 30;

function registerFaqStatsSocket(io) {
  io.on("connection", function (socket) {
    socket.emit("faq:stats", getStats());

    let windowStart = Date.now();
    let events = 0;

    socket.on("faq:open", function (payload) {
      if (!payload || typeof payload.faqId !== "string") return;

      const now = Date.now();
      if (now - windowStart > RATE_WINDOW_MS) {
        windowStart = now;
        events = 0;
      }
      events += 1;
      if (events > RATE_MAX_EVENTS) return;

      if (!increment(payload.faqId)) return;
      io.emit("faq:stats", getStats());
    });
  });
}

module.exports = {
  registerFaqStatsSocket
};
