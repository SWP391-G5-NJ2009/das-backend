require("dotenv").config();

const cors = require("cors");
const express = require("express");
const adminRoutes = require("./routes/admin.route");
const authRoutes = require("./routes/auth.routes");
const dentalServiceRouter = require("./routes/dentalService.route");
const {
  errorMiddleware,
  notFoundMiddleware,
} = require("./middlewares/error.middleware");
const { sendSuccess } = require("./utils/response");

const app = express();

app.use(
  cors({
    origin: "http://localhost:5173", // 👉 Chỉ định đích danh Frontend của bạn
    credentials: true, // 👉 Cho phép nhận Cookie / Authorization Header
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(express.json());

app.get("/api/health", (req, res) =>
  sendSuccess(res, 200, { status: "ok" }, "OK"),
);

app.use("/api/v1/dental-services", dentalServiceRouter);

app.use("/api/admin", adminRoutes);
app.use("/api/auth", authRoutes);

app.use(notFoundMiddleware);
app.use(errorMiddleware);

module.exports = app;
