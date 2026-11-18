const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "../..");
const PORT = parseInt(process.env.PORT || "8080", 10);
const NODE_ENV = process.env.NODE_ENV || "development";

const PATHS = {
  root: ROOT,
  public: path.join(ROOT, "public"),
  data: process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(ROOT, "data")
};

const TLS_CONFIG = {
  keyPath: process.env.TLS_KEY_PATH || "/etc/letsencrypt/live/general/privkey.pem",
  certPath: process.env.TLS_CERT_PATH || "/etc/letsencrypt/live/general/fullchain.pem"
};

if (process.env.TLS_ENABLED === "true") {
  TLS_CONFIG.enabled = true;
} else if (process.env.TLS_ENABLED === "false") {
  TLS_CONFIG.enabled = false;
} else {
  TLS_CONFIG.enabled = fs.existsSync(TLS_CONFIG.keyPath) && fs.existsSync(TLS_CONFIG.certPath);
}

function parseTrustProxy(value) {
  if (!value) return false;
  if (value === "true") return true;
  if (value === "false") return false;
  const hops = parseInt(value, 10);
  return Number.isFinite(hops) && hops >= 0 ? hops : false;
}

const DB_REQUIRED_ENV = ["DB_HOST", "DB_USER", "DB_NAME"];
const DB_MISSING_ENV = DB_REQUIRED_ENV.filter(function (name) {
  return !process.env[name];
});

const DB_CONFIG = {
  enabled: DB_MISSING_ENV.length === 0,
  missingEnv: DB_MISSING_ENV,
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || "3306", 10),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === "true"
    ? {
        rejectUnauthorized: true,
        ...(process.env.DB_SSL_CA ? { ca: process.env.DB_SSL_CA } : {})
      }
    : undefined
};

const POLL_SESSION_SECRET =
  process.env.POLL_SESSION_SECRET || crypto.randomBytes(32).toString("hex");
const BRICK_WALL_HASH_SECRET =
  process.env.BRICK_WALL_HASH_SECRET || POLL_SESSION_SECRET;

if (!process.env.POLL_SESSION_SECRET) {
  console.warn("[Config] POLL_SESSION_SECRET is not set; using an ephemeral secret.");
}
if (!process.env.BRICK_WALL_HASH_SECRET) {
  console.warn("[Config] BRICK_WALL_HASH_SECRET is not set; falling back to the poll session secret.");
}
if (DB_MISSING_ENV.length) {
  console.warn("[Config] Poll database disabled; missing environment variables: " + DB_MISSING_ENV.join(", "));
}

module.exports = {
  PORT,
  NODE_ENV,
  PATHS,
  TLS_CONFIG,
  TRUST_PROXY: parseTrustProxy(process.env.TRUST_PROXY),
  DB_CONFIG,
  POLL_SESSION_SECRET,
  BRICK_WALL_HASH_SECRET
};
