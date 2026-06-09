require("dotenv").config();

const cors = require("cors");
const express = require("express");
const adminRoutes = require("./routes/admin.route");
const authRoutes = require("./routes/auth.route");
const consultationRoutes = require("./routes/consultation.route");
const dentalServiceRoutes = require("./routes/dentalService.route");
const paymentRoutes = require("./routes/payment.routes");
const receptionistRoutes = require("./routes/receptionist.route");
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
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(express.json());


app.get("/api/health", (req, res) =>
  sendSuccess(res, 200, { status: "ok" }, "OK"),
);

app.use("/api/consultations", consultationRoutes);
app.use("/api/services", dentalServiceRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/receptionist", receptionistRoutes);

app.use(notFoundMiddleware);
app.use(errorMiddleware);

module.exports = app;
