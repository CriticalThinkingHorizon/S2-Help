const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "../..");
const PORT = parseInt(process.env.PORT || "4443", 10);
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

module.exports = {
  PORT,
  NODE_ENV,
  PATHS,
  TLS_CONFIG
};
