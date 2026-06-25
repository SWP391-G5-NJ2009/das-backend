const express = require("express");
const profileController = require("./profile.controller");
const authMiddleware = require("../../middlewares/auth.middleware");

const router = express.Router();

router.use(authMiddleware);

router.get("/me", profileController.getMyProfile);
router.patch("/me", profileController.updateMyProfile);

module.exports = router;
