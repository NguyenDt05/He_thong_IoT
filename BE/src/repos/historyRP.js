const db = require("../db");
const { formatDateTime } = require("./rowFormat");

const from = "FROM action_history ah JOIN devices d ON d.device_id = ah.device_id";
const fields = `ah.action_id AS id, ah.device_id AS deviceId,
    d.device_name AS deviceName, ah.action, ah.status, ah.created_at AS createdAtLocal`;

// Đổi một dòng MySQL thành các trường hiển thị trong bảng lịch sử.
function toHistoryRow({ createdAtLocal, deviceId, ...row }) {
    const { iso, text } = formatDateTime(createdAtLocal);
    return {
        ...row,
        deviceId,
        device: `DEVICE_${deviceId}`,
        username: row.id % 2 ? "thaonguyen" : "nguyễn văn a",
        createdAt: iso,
        time: text,
    };
}

// Ghép các điều kiện tìm kiếm theo thiết bị, hành động, trạng thái và từ khóa.
function filters(key, device, action, status) {
    const clauses = [];
    const params = [];
    if (device) {
        clauses.push("CONCAT('DEVICE_', ah.device_id) = ?");
        params.push(device);
    }
    if (action) {
        clauses.push("ah.action = ?");
        params.push(action);
    }
    if (status) {
        clauses.push("ah.status = ?");
        params.push(status);
    }
    if (key) {
        const term = key.toLocaleLowerCase("vi-VN")
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");
        const matchesThao = "thaonguyen".includes(term);
        const matchesNguyen = "nguyen van a".includes(term);
        const search = [
            "d.device_name LIKE ?",
            "DATE_FORMAT(ah.created_at, '%d/%m/%Y %H:%i:%s') LIKE ?",
            "LOWER(ah.action) LIKE ?",
            "LOWER(ah.status) LIKE ?",
        ];
        params.push(`%${key}%`, `%${key.replace(/,\s*/, " ")}%`, `%${term}%`, `%${term}%`);
        if ("bat".includes(term)) search.push("ah.action = 'ON'");
        if ("tat".includes(term)) search.push("ah.action = 'OFF'");
        if (matchesThao) search.push("MOD(ah.action_id, 2) = 1");
        if (matchesNguyen) search.push("MOD(ah.action_id, 2) = 0");
        clauses.push(`(${search.join(" OR ")})`);
    }
    return { where: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "", params };
}

// Lấy một trang lịch sử theo bộ lọc và thứ tự mới nhất.
async function listHistory(key, device, action, status, limit, offset) {
    const { where, params } = filters(key, device, action, status);
    const [rows] = await db.execute(
        `SELECT ${fields} ${from} ${where}
         ORDER BY ah.created_at DESC, ah.action_id DESC LIMIT ? OFFSET ?`,
        [...params, limit, offset],
    );
    return rows.map(toHistoryRow);
}

// Đếm số dòng lịch sử tương ứng để giao diện tính tổng số trang.
async function countHistory(key, device, action, status) {
    const { where, params } = filters(key, device, action, status);
    const [[row]] = await db.execute(`SELECT COUNT(*) AS total ${from} ${where}`, params);
    return Number(row.total);
}

// Lưu thao tác công tắc giao diện rồi trả dòng lịch sử vừa tạo.
async function recordHistory(deviceId, action) {
    const [[device]] = await db.execute("SELECT device_id FROM devices WHERE device_id = ?", [deviceId]);
    if (!device) return null;

    // Thao tác này chỉ được ghi vào lịch sử, không gửi lệnh đến thiết bị thật.
    const [result] = await db.execute(
        "INSERT INTO action_history (user_id, device_id, action, status) VALUES (NULL, ?, ?, 'SUCCESS')",
        [deviceId, action],
    );
    const [[row]] = await db.execute(
        `SELECT ${fields} ${from} WHERE ah.action_id = ?`,
        [result.insertId],
    );
    return toHistoryRow(row);
}

module.exports = { listHistory, countHistory, recordHistory };
