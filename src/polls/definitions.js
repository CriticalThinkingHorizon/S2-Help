"use strict";

const fs = require("fs");
const path = require("path");
const { PATHS } = require("../config");
const { parseDefinition } = require("./validation");

const POLLS_DIR = path.join(PATHS.public, "data", "polls");
let cachedDefinitions = null;

function loadDefinitions() {
  if (cachedDefinitions) return cachedDefinitions;

  const definitions = [];
  let files = [];
  try {
    files = fs.readdirSync(POLLS_DIR).filter(function (file) {
      return file.endsWith(".json");
    });
  } catch (error) {
    console.error("[Polls] Failed to read poll definitions:", error.message || error);
    cachedDefinitions = definitions;
    return cachedDefinitions;
  }

  files.forEach(function (file) {
    try {
      const raw = fs.readFileSync(path.join(POLLS_DIR, file), "utf8");
      definitions.push(parseDefinition(JSON.parse(raw)));
    } catch (error) {
      console.error("[Polls] Invalid poll definition " + file + ":", error.message || error);
    }
  });

  cachedDefinitions = definitions;
  return cachedDefinitions;
}

function getDefinition(slug) {
  return loadDefinitions().find(function (definition) {
    return definition.slug === slug;
  }) || null;
}

module.exports = {
  loadDefinitions,
  getDefinition
};
