"use strict";

const mysql = require("mysql2/promise");
const { DB_CONFIG } = require("../config");

let pool = null;

function getPool() {
  if (!DB_CONFIG.enabled) return null;
  if (!pool) {
    pool = mysql.createPool({
      host: DB_CONFIG.host,
      port: DB_CONFIG.port,
      user: DB_CONFIG.user,
      password: DB_CONFIG.password,
      database: DB_CONFIG.database,
      ssl: DB_CONFIG.ssl,
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 20,
      multipleStatements: false,
      timezone: "Z"
    });
  }
  return pool;
}

function isEnabled() {
  return DB_CONFIG.enabled;
}

module.exports = {
  getPool,
  isEnabled
};
