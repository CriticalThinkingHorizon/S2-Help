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

const io = new Server(server, {
  cors: { origin: "*" }
});

registerFaqStatsSocket(io);

server.listen(PORT, function () {
  const protocol = TLS_CONFIG.enabled ? "https" : "http";
  console.log("Server listening on " + protocol + "://0.0.0.0:" + PORT);
});
