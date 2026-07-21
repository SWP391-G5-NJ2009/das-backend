const clinicInfoDao = require("./clinicInfo.dao");
const AppError = require("../../utils/AppError");

const DEFAULT_CLINIC_INFO = {
  clinic_name: "DentalCare",
  hotline: "0839303396",
  address: "Thach That Hoa Lac, Ha noi, Vietnam",
  open_time: "8:00 AM",
  close_time: "8:00 PM",
  operating_hours: "8:00 AM - 8:00 PM",
  introduction:
    "Professional dental care with experienced dentists and modern equipment.",
  facilities: [],
};

function firstDefined(row, keys) {
  return keys.map((key) => row?.[key]).find((value) => value !== undefined);
}

function normalizeList(value, fallback = []) {
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(/\r?\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return fallback;
}

function formatClock(value) {
  const text = String(value || "").trim();
  const match = text.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);

  if (!match) return text;

  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

function serializeClinicInfo(row = {}) {
  const openTime =
    firstDefined(row, ["open_time"]) || DEFAULT_CLINIC_INFO.open_time;
  const closeTime =
    firstDefined(row, ["close_time"]) || DEFAULT_CLINIC_INFO.close_time;
  const operatingHours =
    firstDefined(row, ["operating_hours", "working_hours"]) ||
    `${formatClock(openTime)} - ${formatClock(closeTime)}`;

  return {
    clinic_name: firstDefined(row, ["name"]) || DEFAULT_CLINIC_INFO.clinic_name,
    hotline: firstDefined(row, ["hotline"]) || DEFAULT_CLINIC_INFO.hotline,
    address: firstDefined(row, ["address"]) || DEFAULT_CLINIC_INFO.address,
    open_time: openTime,
    close_time: closeTime,
    operating_hours: operatingHours || DEFAULT_CLINIC_INFO.operating_hours,
    introduction:
      firstDefined(row, ["introduction", "description"]) ||
      DEFAULT_CLINIC_INFO.introduction,
    facilities: normalizeList(
      firstDefined(row, ["facilities", "facility_list"]),
      DEFAULT_CLINIC_INFO.facilities,
    ),
    email: firstDefined(row, ["email"]) || null,
  };
}

async function getPublicClinicInfo() {
  const { data, error } = await clinicInfoDao.findClinicInfo();

  if (error) {
    throw new AppError(
      "Không thể tải thông tin phòng khám. Vui lòng thử lại sau.",
      500,
      "DB_ERROR",
    );
  }

  const row = Array.isArray(data) ? data[0] : data;
  return serializeClinicInfo(row || {});
}

async function updateClinicInfo(payload) {
  const { data: currentData, error: findError } =
    await clinicInfoDao.findClinicInfo();

  if (findError) {
    throw new AppError(findError.message, 500, "DB_ERROR");
  }

  const current = Array.isArray(currentData) ? currentData[0] : currentData;
  if (!current) {
    throw new AppError(
      "Không tìm thấy thông tin phòng khám.",
      404,
      "CLINIC_INFO_NOT_FOUND",
    );
  }

  const { data, error } = await clinicInfoDao.updateClinicInfo(
    current.clinic_id,
    {
      name: payload.clinicName,
      address: payload.address,
      hotline: payload.hotline,
      open_time: payload.openTime,
      close_time: payload.closeTime,
    },
  );

  if (error) {
    throw new AppError(error.message, 500, "DB_ERROR");
  }

  return serializeClinicInfo(data);
}

module.exports = {
  getPublicClinicInfo,
  updateClinicInfo,
};
