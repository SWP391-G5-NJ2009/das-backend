const queueService = require("./queue.service");
const { sendSuccess } = require("../../utils/response");
const { validateCreateFollowUp } = require("./queue.validator");

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

module.exports = {
  createFollowUp,
  getAllQueues,
  getMyQueue,
  getQueueDetail,
};
