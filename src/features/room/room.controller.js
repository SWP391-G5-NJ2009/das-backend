const roomService = require("./room.service");
const { validateRoomPayload } = require("./room.validator");
const { sendSuccess } = require("../../utils/response");

async function getAllRooms(req, res, next) {
  try {
    const rooms = await roomService.getAllRooms();
    return sendSuccess(res, 200, rooms, "Lấy danh sách phòng thành công.");
  } catch (error) {
    return next(error);
  }
}

async function createRoom(req, res, next) {
  try {
    const payload = validateRoomPayload(req.body);
    const room = await roomService.createRoom(payload);
    return sendSuccess(res, 201, room, "Tạo phòng thành công.");
  } catch (error) {
    return next(error);
  }
}

async function updateRoom(req, res, next) {
  try {
    const { id } = req.params;
    const payload = validateRoomPayload(req.body);
    const room = await roomService.updateRoom(id, payload);
    return sendSuccess(res, 200, room, "Cập nhật phòng thành công.");
  } catch (error) {
    return next(error);
  }
}

async function deleteRoom(req, res, next) {
  try {
    const { id } = req.params;
    const room = await roomService.deleteRoom(id);
    return sendSuccess(res, 200, room, "Xóa phòng thành công.");
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createRoom,
  deleteRoom,
  getAllRooms,
  updateRoom,
};
