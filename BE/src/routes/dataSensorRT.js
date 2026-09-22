const express = require('express');
const ctrl = require('../controller/dataSensorCtrl');
// Đường dẫn GET cho danh sách cảm biến.
const router = express.Router();

// GET /api/data-sensor nhận từ khóa, trường tìm kiếm, loại cảm biến và phân trang.
router.get('/', ctrl.layDuLieuCB_ctrl);

// Xuất router để app.js gắn vào tiền tố /api/data-sensor.
module.exports = router;    
