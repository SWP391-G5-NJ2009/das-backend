const express = require("express");
const router = express.Router();
const dentalServiceController = require("./dentalService.controller");
const authMiddleware = require("../../middlewares/auth.middleware");
const requireRole = require("../../middlewares/role.middleware");

router.get("/", dentalServiceController.getAllServices);
router.delete(
  "/:id",
  authMiddleware,
  requireRole("owner"),
  dentalServiceController.deleteService,
);
router.post(
  "/",
  authMiddleware,
  requireRole("owner"),
  dentalServiceController.createService,
);
router.get("/categories", dentalServiceController.getAllCategories);
router.put(
  "/:id",
  authMiddleware,
  requireRole("owner"),
  dentalServiceController.updateService,
);

module.exports = router;
