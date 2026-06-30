const express = require("express");
const router = express.Router();
const dentalServiceController = require("./dentalService.controller");
const authMiddleware = require("../../middlewares/auth.middleware");
const requireRole = require("../../middlewares/role.middleware");

router.get("/", dentalServiceController.getAllServices);
router.get("/categories", dentalServiceController.getAllCategories);
router.get("/public", dentalServiceController.getPublicServices);
router.get("/:id/dentists", dentalServiceController.getDentistsByService);
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
router.put(
  "/:id",
  authMiddleware,
  requireRole("owner"),
  dentalServiceController.updateService,
);

module.exports = router;
