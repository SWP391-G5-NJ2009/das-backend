const supabase = require("../../config/supabase");

async function findAllRooms() {
  return supabase
    .from("room_info")
    .select("room_id, room_name, specialization, status")
    .order("room_id", { ascending: true });
}

async function insertRoom(payload) {
  return supabase.from("room_info").insert([payload]).select();
}

async function updateRoom(id, payload) {
  return supabase.from("room_info").update(payload).eq("room_id", id).select();
}

async function deleteRoom(id) {
  return supabase.from("room_info").delete().eq("room_id", id).select();
}

async function countSchedulesByRoomId(id) {
  return supabase
    .from("schedules")
    .select("schedule_id", { count: "exact", head: true })
    .eq("room_id", id);
}

module.exports = {
  countSchedulesByRoomId,
  deleteRoom,
  findAllRooms,
  insertRoom,
  updateRoom,
};
