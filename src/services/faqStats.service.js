"use strict";

const fs = require("fs");
const path = require("path");
const { PATHS } = require("../config");

const DATA_FILE = path.join(PATHS.data, "faq-stats.json");
const FAQ_FILE = path.join(PATHS.public, "data", "faq.json");
const SAVE_DEBOUNCE_MS = 2000;
const MAX_ID_LENGTH = 200;
const MAX_ENTRIES = 1000;

function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/<[^>]*>/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-+|-+$)/g, "");
}

function loadAllowedIds() {
  const ids = new Set();
  try {
    const items = JSON.parse(fs.readFileSync(FAQ_FILE, "utf8"));
    if (Array.isArray(items)) {
      items.forEach(function (item) {
        if (!item || typeof item.q !== "string") return;
        ids.add(item.id || "faq-" + slugify(item.q));
      });
    }
  } catch (error) {
    console.error("[FAQ Stats] Failed to load FAQ allowlist:", error.message || error);
  }
  return ids;
}

const ALLOWED_IDS = loadAllowedIds();

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
  if (!ALLOWED_IDS.has(id)) return false;
  if (!Object.prototype.hasOwnProperty.call(stats, id) && Object.keys(stats).length >= MAX_ENTRIES) {
    return false;
  }

  stats[id] = (stats[id] || 0) + 1;
  scheduleSave();
  return true;
}

module.exports = {
  getStats,
  increment
};
