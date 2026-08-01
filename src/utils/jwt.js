const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error(
    "Missing or weak JWT_SECRET. Set JWT_SECRET to at least 32 characters.",
  );
}

function signJWT(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function verifyJWT(token) {
  return jwt.verify(token, JWT_SECRET);
}

module.exports = {
  signJWT,
  verifyJWT,
};
