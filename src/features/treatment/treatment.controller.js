const treatmentService = require("./treatment.service");
const { sendSuccess } = require("../../utils/response");

async function createTreatment(req, res, next) {
  try {
    const data = await treatmentService.createTreatment({
      apptId: Number(req.body.appointmentId),
      dentistId: req.user.profileId,
      clinicalExamination: req.body.clinicalExamination,
      diagnosis: req.body.diagnosis,
      treatmentNote: req.body.treatmentNote,
      postTreatmentInstructions: req.body.postTreatmentInstructions,
      completePlan: req.body.completePlan === true,
    });
    return sendSuccess(res, 201, data, "Lưu kết quả điều trị thành công.");
  } catch (err) {
    return next(err);
  }
}

async function getTreatmentContext(req, res, next) {
  try {
    const data = await treatmentService.getTreatmentContext({
      apptId: Number(req.params.appointmentId),
      dentistId: req.user.profileId,
    });
    return sendSuccess(res, 200, data, "Lấy các lần điều trị thành công.");
  } catch (err) {
    return next(err);
  }
}

async function startTreatmentPlan(req, res, next) {
  try {
    const data = await treatmentService.startTreatmentPlan({
      apptId: Number(req.body.appointmentId),
      dentistId: req.user.profileId,
    });
    return sendSuccess(res, 201, data, "Bắt đầu lộ trình điều trị thành công.");
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  createTreatment,
  getTreatmentContext,
  startTreatmentPlan,
};
