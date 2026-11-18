"use strict";

const express = require("express");
const healthRoutes = require("./health.routes");
const pollRoutes = require("./poll.routes");

const router = express.Router();

router.use("/", healthRoutes);
router.use("/", pollRoutes);

module.exports = router;
