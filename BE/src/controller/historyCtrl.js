const historyService = require("../service/historySV");

// Đọc bộ lọc từ URL và trả danh sách lịch sử đã phân trang.
async function listHistory(req, res) {
    try {
        const query = req.query;
        const key = typeof query.key === "string" ? query.key.trim() : null;
        const device = typeof query.device === "string" ? query.device : null;
        const action = typeof query.action === "string" ? query.action : null;
        const status = typeof query.status === "string" ? query.status : null;

        res.json(await historyService.listHistory(
            key, device, action, status, query.page, query.limit,
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

    try {
        const row = await historyService.recordHistory(deviceId, action);
        if (!row) return res.status(404).json({ error: "Không tìm thấy thiết bị" });
        return res.status(201).json(row);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Không thể lưu lịch sử hoạt động" });
    }
}

module.exports = { listHistory, recordHistory };
