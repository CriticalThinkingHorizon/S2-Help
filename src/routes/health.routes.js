"use strict";

const express = require("express");
const { getStats } = require("../services/faqStats.service");
const { DB_CONFIG } = require("../config");

const router = express.Router();

router.get("/health", function (req, res) {
  res.json({
    ok: true,
    faqCount: Object.keys(getStats()).length,
    polls: {
      configured: DB_CONFIG.enabled,
      missingEnv: DB_CONFIG.missingEnv
    }
  });
});

module.exports = router;
