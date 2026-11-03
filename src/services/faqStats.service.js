"use strict";

const fs = require("fs");
const path = require("path");
const { PATHS } = require("../config");

const DATA_FILE = path.join(PATHS.data, "faq-stats.json");
const SAVE_DEBOUNCE_MS = 2000;
const MAX_ID_LENGTH = 200;

function loadStats() {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    return {};
  }
}

let stats = loadStats();
let saveTimer = null;

function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(function () {
    saveTimer = null;
    try {
      fs.mkdirSync(PATHS.data, { recursive: true });
      fs.writeFileSync(DATA_FILE, JSON.stringify(stats, null, 2));
    } catch (error) {
      console.error("[FAQ Stats] Failed to persist stats:", error.message || error);
    }
  }, SAVE_DEBOUNCE_MS);
}

function getStats() {
  return stats;
}

function increment(faqId) {
  if (typeof faqId !== "string") return false;
  const id = faqId.trim().slice(0, MAX_ID_LENGTH);
  if (!id) return false;

  stats[id] = (stats[id] || 0) + 1;
  scheduleSave();
  return true;
}

module.exports = {
  getStats,
  increment
};
