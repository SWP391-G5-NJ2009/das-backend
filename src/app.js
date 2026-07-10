require("dotenv").config();

const cors = require("cors");
const express = require("express");
const accountRoutes = require("./features/account/account.routes");
const authRoutes = require("./features/auth/auth.routes");
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
const {
  errorMiddleware,
  notFoundMiddleware,
} = require("./middlewares/error.middleware");
const { sendSuccess } = require("./utils/response");

const app = express();

app.use(
  cors({
    origin: "http://localhost:5173",
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

app.use(notFoundMiddleware);
app.use(errorMiddleware);

module.exports = app;
