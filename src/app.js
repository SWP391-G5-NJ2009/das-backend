const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const cors = require("cors");
const express = require("express");
const accountRoutes = require("./features/account/account.routes");
const authRoutes = require("./features/auth/auth.routes");
const clinicInfoRoutes = require("./features/clinicInfo/clinicInfo.routes");
const consultationRoutes = require("./features/consultation/consultation.routes");
const dentalServiceRoutes = require("./features/dentalService/dentalService.routes");
const paymentRoutes = require("./features/payment/payment.routes");
const appointmentRoutes = require("./features/appointment/appointment.routes");
const patientRoutes = require("./features/patient/patient.routes");
const slotRoutes = require("./features/slot/slot.routes");
const profileRoutes = require("./features/profile/profile.routes");
const roomRoutes = require("./features/room/room.routes");
const revenueRoutes = require("./features/revenue/revenue.routes");
const patientAnalyticsRoutes = require("./features/patientAnalytics/patientAnalytics.routes");
const clinicScheduleManagementRoutes = require("./features/clinicScheduleManagement/clinicScheduleManagement.routes");
const scheduleRoutes = require("./features/schedule/schedule.routes");
const staffRoutes = require("./features/staff/staff.routes");
const {
  errorMiddleware,
  notFoundMiddleware,
} = require("./middlewares/error.middleware");
const { sendSuccess } = require("./utils/response");

const app = express();
const allowedOrigins = new Set(
  [
    process.env.FRONTEND_URL,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
  ].filter(Boolean),
);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(express.json());

app.get("/api/health", (req, res) =>
  sendSuccess(res, 200, { status: "ok" }, "OK"),
);

app.use("/api/consultations", consultationRoutes);
app.use("/api/clinic-info", clinicInfoRoutes);
app.use("/api/services", dentalServiceRoutes);
app.use("/api/admin", accountRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/patients", patientRoutes);
app.use("/api/slots", slotRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/rooms", roomRoutes);
app.use("/api/reports/revenue", revenueRoutes);
app.use("/api/reports/patient", patientAnalyticsRoutes);
app.use("/api/schedule/management", clinicScheduleManagementRoutes);
app.use("/api/schedules", scheduleRoutes);
app.use("/api/staff", staffRoutes);
app.use(notFoundMiddleware);
app.use(errorMiddleware);

module.exports = app;
