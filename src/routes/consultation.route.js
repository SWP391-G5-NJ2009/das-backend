const express = require("express")
const consultationController = require("../controllers/consultation.controller")
const router = express.Router()

router.post(
    "/consultation",
    consultationController.createConsultationRequest,
)

module.exports = router;