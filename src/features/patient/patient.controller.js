const patientService = require("./patient.service");
const { validateCreatePatientAccount } = require("./patient.validator");
const { sendSuccess } = require("../../utils/response");
/**
 * GET /api/patients/search?q=...
 * Receptionist: search patients by name or phone.
 */
async function searchPatients(req, res, next) {
  try {
    const q = (req.query.q || "").trim();
    if (q.length < 2) {
      return sendSuccess(res, 200, [], "Từ khóa tìm kiếm quá ngắn.");
    }
    const data = await patientService.searchPatients(q);
    return sendSuccess(res, 200, data, "Lấy danh sách bệnh nhân thành công.");
  } catch (err) {
    return next(err);
  }
}

async function createPatientAccount(req, res, next) {
  try {
    const payload = validateCreatePatientAccount(req.body);
    const data = await patientService.createPatientAccount(payload);
    return sendSuccess(res, 201, data, "Tạo tài khoản bệnh nhân thành công.");
  } catch (err) {
    return next(err);
  }
}

async function getMyTreatmentHistory(req, res, next) {
  try {
    const data = await patientService.getTreatmentHistory(req.user.profileId);
    return sendSuccess(
      res,
      200,
      data,
      "Lấy lịch sử điều trị thành công.",
    );
  } catch (err) {
    return next(err);
  }
}

async function getTreatmentHistoryByPatient(req, res, next) {
  try {
    const data = await patientService.getTreatmentHistory(req.params.patientId, {
      actorProfileId: req.user.profileId,
      actorRole: req.user.role,
    });
    return sendSuccess(
      res,
      200,
      data,
      "Lấy lịch sử điều trị thành công.",
    );
  } catch (err) {
    return next(err);
  }
}

async function getMyTreatedPatients(req, res, next) {
  try {
    const data = await patientService.getTreatedPatientsByDentist(
      req.user.profileId,
    );
    return sendSuccess(
      res,
      200,
      data,
      "Lấy danh sách bệnh nhân đã điều trị thành công.",
    );
  } catch (err) {
    return next(err);
  }
}

/**
 * PATCH /api/patients/:patientId/lift-ban
 * Receptionist: Lift booking ban — resolves all No-Show appointments for the patient.
 */
async function liftBookingBan(req, res, next) {
  try {
    const patientId = Number(req.params.patientId);
    const data = await patientService.liftBookingBan(patientId);
    return sendSuccess(res, 200, data, "Gỡ chặn đặt lịch thành công.");
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /api/patients/walk-in
 * Receptionist: tạo walk-in patient record (không cần account).
 */
async function createWalkInPatient(req, res, next) {
  try {
    const fullName = (req.body.fullName || "").trim();
    const phone = (req.body.phone || "").trim();
    if (!fullName || !phone) {
      return next(
        new (require("../../utils/AppError"))(
          "Họ tên và số điện thoại là bắt buộc.",
          400,
          "VALIDATION_ERROR",
        ),
      );
    }
    const data = await patientService.createWalkInPatient({ fullName, phone });
    return sendSuccess(res, 201, data, "Thêm bệnh nhân thành công.");
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  searchPatients,
  createPatientAccount,
  createWalkInPatient,
  getMyTreatmentHistory,
  getMyTreatedPatients,
  getTreatmentHistoryByPatient,
  liftBookingBan,
};
