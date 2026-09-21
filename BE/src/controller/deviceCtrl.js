const deviceService = require("../service/deviceSV");

// Trả danh sách thiết bị dưới dạng JSON hoặc thông báo lỗi HTTP.
async function listDevices(req, res) {
    try {
        res.json(await deviceService.listDevices());
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Không thể tải thiết bị" });
    }
}

module.exports = { listDevices };
