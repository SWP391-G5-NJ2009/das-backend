require("dotenv").config();

const cors = require("cors");
const express = require("express");
const adminRoutes = require("./routes/admin.route");
const authRoutes = require("./routes/auth.routes");
const consultationRoutes = require("./routes/consultation.route");
const receptionistRoutes = require("./routes/receptionist.route")
const { errorMiddleware, notFoundMiddleware } = require("./middlewares/error.middleware");
const { sendSuccess } = require("./utils/response");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) =>
  sendSuccess(res, 200, { status: "ok" }, "OK"),
);

app.use("/api", consultationRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/receptionist", receptionistRoutes);

app.use(notFoundMiddleware);
app.use(errorMiddleware);

module.exports = app;
