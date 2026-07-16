const express = require("express");
const router = express.Router();
const clinicInfoController = require("./clinicInfo.controller");
const authMiddleware = require("../../middlewares/auth.middleware");
const requireRole = require("../../middlewares/role.middleware");

router.get("/", clinicInfoController.getPublicClinicInfo);
router.patch(
  "/",
  authMiddleware,
  requireRole("owner"),
  clinicInfoController.updateClinicInfo,
);

module.exports = router;
