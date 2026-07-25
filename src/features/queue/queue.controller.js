const queueService = require("./queue.service");
const { sendSuccess } = require("../../utils/response");
const {
  validateCreateFollowUp,
  validateCreateTreatmentRecord,
  validateCreateWalkIn,
  validateUpdateStatus,
} = require("./queue.validator");

async function getAllQueues(req, res, next) {
  try {
    const data = await queueService.getAllQueues(req.query);
    return sendSuccess(res, 200, data, "Lấy danh sách hàng đợi thành công.");
  } catch (error) {
    return next(error);
  }
}

async function getMyQueue(req, res, next) {
  try {
    const data = await queueService.getDentistQueues(
      req.user.profileId,
      req.query,
    );
    return sendSuccess(res, 200, data, "Lấy hàng đợi của nha sĩ thành công.");
  } catch (error) {
    return next(error);
  }
}

async function getQueueDetail(req, res, next) {
  try {
    const data = await queueService.getQueueDetail(req.params.id, req.user);
    return sendSuccess(res, 200, data, "Lấy chi tiết hàng đợi thành công.");
  } catch (error) {
    return next(error);
  }
}

async function createFollowUp(req, res, next) {
  try {
    const payload = validateCreateFollowUp(req.body);
    const data = await queueService.createFollowUp(
      req.params.id,
      payload,
      req.user,
    );
    return sendSuccess(res, 201, data, "Tạo thông báo tái khám thành công.");
  } catch (error) {
    return next(error);
  }
}

async function createWalkIn(req, res, next) {
  try {
    const payload = validateCreateWalkIn(req.body);
    const data = await queueService.createWalkIn(payload);
    return sendSuccess(res, 201, data, "Đã thêm bệnh nhân walk-in vào hàng đợi.");
  } catch (error) {
    return next(error);
  }
}

async function updateStatus(req, res, next) {
  try {
    const { status } = validateUpdateStatus(req.body);
    const data = await queueService.updateStatus(
      req.params.id,
      status,
      req.user,
    );
    return sendSuccess(res, 200, data, "Cập nhật trạng thái hàng đợi thành công.");
  } catch (error) {
    return next(error);
  }
}

async function createTreatmentRecord(req, res, next) {
  try {
    const payload = validateCreateTreatmentRecord(req.body);
    const data = await queueService.createTreatmentRecord(
      req.params.id,
      payload,
      req.user,
    );
    return sendSuccess(
      res,
      201,
      data,
      "Đã lưu kết quả điều trị và hoàn tất lượt walk-in.",
    );
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createFollowUp,
  createTreatmentRecord,
  createWalkIn,
  getAllQueues,
  getMyQueue,
  getQueueDetail,
  updateStatus,
};
