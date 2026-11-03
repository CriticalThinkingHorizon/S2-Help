"use strict";

const path = require("path");
const express = require("express");
const { PATHS } = require("./config");
const routes = require("./routes");

const app = express();

app.disable("x-powered-by");
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use(routes);

app.use(express.static(PATHS.public, { extensions: ["html"] }));

app.get("*", function (req, res) {
  res.sendFile(path.join(PATHS.public, "index.html"));
});

module.exports = app;
