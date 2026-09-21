const express = require("express");
const ctrl = require("../controller/deviceCtrl");
// Đường dẫn GET cho danh sách thiết bị.
const router = express.Router();

router.get("/", ctrl.listDevices);

module.exports = router;
