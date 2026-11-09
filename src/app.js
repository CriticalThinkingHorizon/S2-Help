"use strict";

const path = require("path");
const express = require("express");
const { PATHS } = require("./config");
const routes = require("./routes");

const app = express();

app.disable("x-powered-by");

app.use(function (req, res, next) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "img-src 'self' data:",
      "style-src 'self'",
      "script-src 'self'",
      "font-src 'self'",
      "connect-src 'self' ws: wss:",
      "form-action 'self'"
    ].join("; ")
  );
  if (req.secure || req.headers["x-forwarded-proto"] === "https") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
});

app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: false, limit: "16kb" }));

app.use(routes);

app.use(express.static(PATHS.public, { extensions: ["html"] }));

app.get("*", function (req, res) {
  res.sendFile(path.join(PATHS.public, "index.html"));
});

module.exports = app;
