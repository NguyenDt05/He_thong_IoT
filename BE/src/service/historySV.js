const historyRP = require("../repos/historyRP");
const { normalizePagination } = require("./pagination");

// Chuẩn hóa phân trang rồi lấy danh sách lịch sử cùng tổng số dòng.
async function listHistory(key, deviceId, action, status, requestedPage, requestedLimit) {
    const { page, limit } = normalizePagination(requestedPage, requestedLimit);
    const offset = (page - 1) * limit;
    const data = await historyRP.listHistory(key, deviceId, action, status, limit, offset);
    const total = await historyRP.countHistory(key, deviceId, action, status);

    return { data, page, limit, total, totalPages: Math.ceil(total / limit) };
}

// Chuyển yêu cầu ghi thao tác xuống repository.
async function recordHistory(deviceId, action, userId = null) {
    return historyRP.recordHistory(deviceId, action, userId);
}

module.exports = { listHistory, recordHistory };
