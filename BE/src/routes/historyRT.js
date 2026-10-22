const express = require("express");
const ctrl = require("../controller/historyCtrl");
const { optionalAuth } = require("../service/authSV");
// GET đọc bảng lịch sử; POST ghi thao tác bật/tắt từ giao diện.
const router = express.Router();

router.get("/", ctrl.listHistory);
router.post("/", optionalAuth, ctrl.recordHistory);

module.exports = router;
