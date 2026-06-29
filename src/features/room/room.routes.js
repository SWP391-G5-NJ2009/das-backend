const express = require("express");
const roomController = require("./room.controller");
const authMiddleware = require("../../middlewares/auth.middleware");
const requireRole = require("../../middlewares/role.middleware");

const router = express.Router();

router.get(
  "/",
  authMiddleware,
  requireRole("owner", "receptionist"),
  roomController.getAllRooms,
);

router.post(
  "/",
  authMiddleware,
  requireRole("owner"),
  roomController.createRoom,
);

router.put(
  "/:id",
  authMiddleware,
  requireRole("owner"),
  roomController.updateRoom,
);

router.delete(
  "/:id",
  authMiddleware,
  requireRole("owner"),
  roomController.deleteRoom,
);

module.exports = router;
