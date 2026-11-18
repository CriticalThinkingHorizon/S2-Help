"use strict";

function isSameOrigin(req) {
  const fetchSite = req.headers["sec-fetch-site"];
  if (fetchSite === "same-origin") return true;
  if (fetchSite) return false;

  const source = req.headers.origin || req.headers.referer;
  if (!source) return false;

  try {
    return new URL(source).host === req.headers.host;
  } catch (error) {
    return false;
  }
}

function requireSameOrigin(req, res, next) {
  if (!isSameOrigin(req)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
}

module.exports = {
  isSameOrigin,
  requireSameOrigin
};
