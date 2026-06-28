const bcrypt = require("bcryptjs");

const PASSWORD_SALT_ROUNDS = 10;

function hashPassword(password) {
  return bcrypt.hash(password, PASSWORD_SALT_ROUNDS);
}

function comparePassword(password, passwordHash) {
  return passwordHash ? bcrypt.compare(password, passwordHash) : false;
}

module.exports = {
  comparePassword,
  hashPassword,
};
