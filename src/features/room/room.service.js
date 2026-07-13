const roomDao = require("./room.dao");
const AppError = require("../../utils/AppError");

function mapRoomPayload({ room_name, specialization, status }) {
  return {
    room_name,
    specialization: specialization || null,
    status: status || "Available",
  };
}

async function getAllRooms() {
  const { data, error } = await roomDao.findAllRooms();

  if (error) {
    throw new AppError(
      "Không thể tải danh sách phòng. Vui lòng thử lại sau.",
      500,
      "DB_ERROR",
    );
  }

  return data || [];
}

async function createRoom(payload) {
  const { data, error } = await roomDao.insertRoom(mapRoomPayload(payload));

  if (error) {
    throw new AppError(
      "Không thể tạo phòng. Vui lòng thử lại sau.",
      500,
      "DB_ERROR",
    );
  }

  return data?.[0] || null;
}

async function updateRoom(id, payload) {
  const { data, error } = await roomDao.updateRoom(id, mapRoomPayload(payload));

  if (error) {
    throw new AppError(
      "Không thể cập nhật phòng. Vui lòng thử lại sau.",
      500,
      "DB_ERROR",
    );
  }

  if (!data || data.length === 0) {
    throw new AppError("Không tìm thấy phòng.", 404, "NOT_FOUND");
  }

  return data[0];
}

async function deleteRoom(id) {
  const { count, error: countError } = await roomDao.countSchedulesByRoomId(id);

  if (countError) {
    throw new AppError(
      "Failed to check room schedule usage.",
      500,
      "DB_ERROR",
    );
  }

  if (count > 0) {
    throw new AppError(
      "This room is linked to schedules and cannot be deleted.",
      409,
      "ROOM_HAS_SCHEDULES",
    );
  }

  const { data, error } = await roomDao.deleteRoom(id);

  if (error) {
    throw new AppError(
      "Không thể xóa phòng. Vui lòng thử lại sau.",
      500,
      "DB_ERROR",
    );
  }

  if (!data || data.length === 0) {
    throw new AppError("Không tìm thấy phòng.", 404, "NOT_FOUND");
  }

  return { room_id: Number(id) };
}

module.exports = {
  createRoom,
  deleteRoom,
  getAllRooms,
  updateRoom,
};
