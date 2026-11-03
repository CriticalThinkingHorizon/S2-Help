"use strict";

const { getStats, increment } = require("../services/faqStats.service");

function registerFaqStatsSocket(io) {
  io.on("connection", function (socket) {
    socket.emit("faq:stats", getStats());

    socket.on("faq:open", function (payload) {
      if (!payload || typeof payload.faqId !== "string") return;
      if (!increment(payload.faqId)) return;
      io.emit("faq:stats", getStats());
    });
  });
}

module.exports = {
  registerFaqStatsSocket
};
