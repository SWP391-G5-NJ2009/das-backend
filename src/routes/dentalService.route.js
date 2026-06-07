const express = require("express");
const router = express.Router();
const dentalServiceController = require("../controllers/dentalService.controller");

// Import middleware bảo mật của nhóm bạn (tên file tùy thuộc nhóm bạn đặt trong folder middlewares)
const authMiddleware = require("../middlewares/auth.middleware");
const requireRole = require("../middlewares/role.middleware");

// Chặn đứng quyền: Phải đăng nhập (protect) VÀ phải có role là 'owner' mới được đi tiếp
router.get(
  "/",
  authMiddleware,
  requireRole("owner"),
  dentalServiceController.getAllServices,
);
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
router.get(
  "/categories",
  authMiddleware,
  requireRole("owner"),
  dentalServiceController.getAllCategories,
);
router.put(
  "/:id",
  authMiddleware,
  requireRole("owner"),
  dentalServiceController.updateService,
);

module.exports = router;
