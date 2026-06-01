const bcrypt = require("bcryptjs");

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function hashOtp(otp) {
  return bcrypt.hash(otp, 10);
}

async function compareOtp(otp, hash) {
  return bcrypt.compare(otp, hash);
}

function getOtpExpiry(minutes = 10) {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

module.exports = {
  compareOtp,
  generateOtp,
  getOtpExpiry,
  hashOtp,
};
