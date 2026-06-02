const express = require("express")
const accountController = require("../controllers/account.controller")
const authMiddleware = require("../middlewares/auth.middleware")
const requireRole = require("../middlewares/role.middleware")
const router = express.Router();

router.get(
    "/accounts",
    authMiddleware,
    requireRole("admin"),
    accountController.getAllAccounts,
);

router.post(
  "/accounts",
  authMiddleware,
  requireRole("admin"),
  accountController.createAccount,
);

router.put(
  "/accounts/:id",
  authMiddleware,
  requireRole("admin"),
  accountController.updateAccount,
);

module.exports = router;