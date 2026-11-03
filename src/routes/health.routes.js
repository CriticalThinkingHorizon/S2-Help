"use strict";

const express = require("express");
const { getStats } = require("../services/faqStats.service");

const router = express.Router();

router.get("/health", function (req, res) {
  res.json({ ok: true, faqCount: Object.keys(getStats()).length });
});

module.exports = router;
