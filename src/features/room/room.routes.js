const express = require("express");
const roomController = require("./room.controller");
const authMiddleware = require("../../middlewares/auth.middleware");
const requireRole = require("../../middlewares/role.middleware");

const router = express.Router();

router.get(
  "/",
  authMiddleware,
  requireRole("manager"),
  roomController.getAllRooms,
);

router.post(
  "/",
  authMiddleware,
  requireRole("manager"),
  roomController.createRoom,
);

router.put(
  "/:id",
  authMiddleware,
  requireRole("manager"),
  roomController.updateRoom,
);

router.delete(
  "/:id",
  authMiddleware,
  requireRole("manager"),
  roomController.deleteRoom,
);

module.exports = router;
