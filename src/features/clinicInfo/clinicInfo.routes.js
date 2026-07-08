const express = require("express");
const router = express.Router();
const clinicInfoController = require("./clinicInfo.controller");

router.get("/", clinicInfoController.getPublicClinicInfo);

module.exports = router;
