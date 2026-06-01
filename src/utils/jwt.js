const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

function ensureSecret() {
  if (!JWT_SECRET || JWT_SECRET.length < 32) {
    throw new Error("JWT_SECRET must be configured and at least 32 characters.");
  }
}

function signJWT(payload) {
  ensureSecret();
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function verifyJWT(token) {
  ensureSecret();
  return jwt.verify(token, JWT_SECRET);
}

module.exports = {
  signJWT,
  verifyJWT,
};
