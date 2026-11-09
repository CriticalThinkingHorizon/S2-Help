"use strict";

process.on("uncaughtException", function (error) {
  console.error("[Process] Uncaught Exception:", error ? error.stack || error : error);
});
process.on("unhandledRejection", function (reason) {
  console.error("[Process] Unhandled Rejection:", reason);
});

const fs = require("fs");
const http = require("http");
const https = require("https");
const { Server } = require("socket.io");
const { PORT, TLS_CONFIG } = require("./src/config");
const app = require("./src/app");
const { registerFaqStatsSocket } = require("./src/sockets/faqStats.socket");

const server = TLS_CONFIG.enabled
  ? https.createServer(
      {
        key: fs.readFileSync(TLS_CONFIG.keyPath),
        cert: fs.readFileSync(TLS_CONFIG.certPath)
      },
      app
    )
  : http.createServer(app);

const DEFAULT_ORIGINS = [
  "https://s2-help.wasmer.app",
  "http://localhost:8080",
  "http://127.0.0.1:8080"
];
function normalizeOrigin(origin) {
  return String(origin || "").trim().replace(/\/+$/, "");
}

const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map(normalizeOrigin)
  .filter(Boolean);
const ORIGINS = (ALLOWED_ORIGINS.length ? ALLOWED_ORIGINS : DEFAULT_ORIGINS).map(normalizeOrigin);

function isAllowedOrigin(origin, host) {
  if (!origin) return true;
  if (ORIGINS.indexOf(normalizeOrigin(origin)) !== -1) return true;
  try {
    const originHost = new URL(origin).hostname;
    const requestHost = String(host || "").split(":")[0];
    return Boolean(originHost && requestHost && originHost === requestHost);
  } catch (error) {
    return false;
  }
}

const io = new Server(server, {
  cors: { origin: ORIGINS, methods: ["GET", "POST"] },
  allowRequest: function (req, callback) {
    callback(null, isAllowedOrigin(req.headers.origin, req.headers.host));
  }
});

registerFaqStatsSocket(io);

server.listen(PORT, function () {
  const protocol = TLS_CONFIG.enabled ? "https" : "http";
  console.log("Server listening on " + protocol + "://0.0.0.0:" + PORT);
});
