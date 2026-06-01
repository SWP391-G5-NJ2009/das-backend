require("dotenv").config();

const cors = require("cors");
const express = require("express");
const authRoutes = require("./routes/auth.routes");
const { errorMiddleware, notFoundMiddleware } = require("./middlewares/error.middleware");
const { sendSuccess } = require("./utils/response");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) =>
  sendSuccess(res, 200, { status: "ok" }, "OK"),
);

app.use("/api/auth", authRoutes);

app.use(notFoundMiddleware);
app.use(errorMiddleware);

module.exports = app;
