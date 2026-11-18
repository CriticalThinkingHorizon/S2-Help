"use strict";

const crypto = require("crypto");
const { BRICK_WALL_HASH_SECRET } = require("../config");

function hashDeviceId(deviceId) {
  return crypto
    .createHmac("sha256", BRICK_WALL_HASH_SECRET)
    .update(String(deviceId))
    .digest("hex");
}

module.exports = {
  hashDeviceId
};
