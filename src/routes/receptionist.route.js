const express = require("express");
const consultationController = require("../controllers/consultation.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const requireRole = require("../middlewares/role.middleware");
const router = express.Router();

module.exports = router;
