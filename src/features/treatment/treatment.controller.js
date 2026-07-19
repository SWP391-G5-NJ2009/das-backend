const treatmentService = require("./treatment.service");
const { sendSuccess } = require("../../utils/response");

async function createTreatment(req, res, next) {
  try {
    const data = await treatmentService.createTreatment({
      apptId: Number(req.body.appointmentId),
      dentistId: req.user.profileId,
      diagnosis: req.body.diagnosis,
      treatmentNote: req.body.treatmentNote,
      prescriptionNote: req.body.prescriptionNote,
      medicines: req.body.medicines,
    });
    return sendSuccess(res, 201, data, "Lưu kết quả điều trị thành công.");
  } catch (err) {
    return next(err);
  }
}

async function listMedicines(req, res, next) {
  try {
    const data = await treatmentService.listMedicines();
    return sendSuccess(res, 200, data, "Lấy danh sách thuốc thành công.");
  } catch (err) {
    return next(err);
  }
}

module.exports = { createTreatment, listMedicines };
