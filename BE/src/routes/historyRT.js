const express = require("express");
const ctrl = require("../controller/historyCtrl");
// GET đọc bảng lịch sử; POST ghi thao tác bật/tắt từ giao diện.
const router = express.Router();

router.get("/", ctrl.listHistory);
router.post("/", ctrl.recordHistory);

module.exports = router;
