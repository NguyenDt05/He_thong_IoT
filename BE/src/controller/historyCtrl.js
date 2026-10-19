const historyService = require("../service/historySV");
const { isControllableDeviceId, isSensorStreamLive } = require("../service/mqttBridge");

// Đọc bộ lọc từ URL và trả danh sách lịch sử đã phân trang.
async function listHistory(req, res) {
    try {
        const query = req.query;
        const key = typeof query.key === "string" ? query.key.trim() : null;
        const requestedDeviceId = query.deviceId;
        let deviceId = null;
        if (requestedDeviceId !== undefined) {
            if (typeof requestedDeviceId !== "string" || !/^[1-9]\d*$/.test(requestedDeviceId)
                || !Number.isSafeInteger(Number(requestedDeviceId))) {
                return res.status(400).json({ error: "deviceId không hợp lệ" });
            }
            deviceId = Number(requestedDeviceId);
        }
        const action = typeof query.action === "string" ? query.action : null;
        const status = typeof query.status === "string" ? query.status : null;

        res.json(await historyService.listHistory(
            key, deviceId, action, status, query.page, query.limit,
        ));
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Không thể tải lịch sử hoạt động" });
    }
}

// Kiểm tra thiết bị, thao tác rồi ghi một dòng lịch sử mới.
async function recordHistory(req, res) {
    const deviceId = Number(req.body?.deviceId);
    const action = req.body?.action;
    if (!Number.isSafeInteger(deviceId) || deviceId < 1 || !["ON", "OFF"].includes(action)) {
        return res.status(400).json({ error: "Thiết bị hoặc thao tác không hợp lệ" });
    }
    if (!isControllableDeviceId(deviceId)) {
        return res.status(422).json({ error: "Thiết bị chưa được cấu hình trên mạch" });
    }
    if (!isSensorStreamLive()) {
        return res.status(503).json({ error: "Mạch cứng chưa kết nối" });
    }

    try {
        const row = await historyService.recordHistory(deviceId, action);
        if (!row) return res.status(404).json({ error: "Không tìm thấy thiết bị" });
        return res.status(201).json(row);
    } catch (error) {
        if (error.code === "COMMAND_PENDING") return res.status(409).json({ error: error.message });
        console.error(error);
        return res.status(500).json({ error: "Không thể lưu lịch sử hoạt động" });
    }
}

module.exports = { listHistory, recordHistory };
