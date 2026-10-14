const db = require("../db");
const { formatDateTime } = require("./rowFormat");

const from = "FROM action_history ah JOIN devices d ON d.device_id = ah.device_id LEFT JOIN users u ON u.user_id = ah.user_id";
const timeoutSeconds = Number(process.env.HARDWARE_COMMAND_TIMEOUT_MS) > 0
    ? Math.ceil(Number(process.env.HARDWARE_COMMAND_TIMEOUT_MS) / 1000) : 30;
const effectiveStatus = `CASE WHEN ah.status = 'PENDING'
    AND ah.created_at < DATE_SUB(CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+07:00'), INTERVAL ${timeoutSeconds} SECOND)
    THEN 'FAILED' ELSE ah.status END`;
const fields = `ah.action_id AS id, ah.device_id AS deviceId,
    d.device_name AS deviceName, u.full_name AS username, ah.action,
    ${effectiveStatus} AS status, ah.created_at AS createdAtLocal`;

// Đổi một dòng MySQL thành các trường hiển thị trong bảng lịch sử.
function toHistoryRow({ createdAtLocal, deviceId, ...row }) {
    const { iso, text } = formatDateTime(createdAtLocal);
    return {
        ...row,
        deviceId,
        device: `DEVICE_${deviceId}`,
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
        clauses.push(`${effectiveStatus} = ?`);
        params.push(status);
    }
    if (key) {
        const term = key.toLocaleLowerCase("vi-VN")
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");
        const search = [
            "d.device_name LIKE ?",
            "u.full_name LIKE ?",
            "DATE_FORMAT(ah.created_at, '%d/%m/%Y %H:%i:%s') LIKE ?",
            "LOWER(ah.action) LIKE ?",
            `LOWER(${effectiveStatus}) LIKE ?`,
        ];
        params.push(`%${key}%`, `%${key}%`, `%${key.replace(/,\s*/, " ")}%`, `%${term}%`, `%${term}%`);
        if ("bat".includes(term)) search.push("ah.action = 'ON'");
        if ("tat".includes(term)) search.push("ah.action = 'OFF'");
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

// Xếp yêu cầu điều khiển để mạch lấy và xác nhận; không ghi thành công giả.
async function recordHistory(deviceId, action) {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const [[device]] = await connection.execute("SELECT device_id FROM devices WHERE device_id = ? FOR UPDATE", [deviceId]);
        if (!device) {
            await connection.rollback();
            return null;
        }
        const [[pending]] = await connection.execute(
            `SELECT action_id FROM action_history
             WHERE device_id = ? AND status = 'PENDING'
               AND created_at >= DATE_SUB(CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+07:00'), INTERVAL ? SECOND)
             LIMIT 1`,
            [deviceId, timeoutSeconds],
        );
        if (pending) {
            await connection.rollback();
            const error = new Error("Thiết bị đang chờ mạch xác nhận lệnh trước");
            error.code = "COMMAND_PENDING";
            throw error;
        }
        const [result] = await connection.execute(
            "INSERT INTO action_history (user_id, device_id, action, status) VALUES (NULL, ?, ?, 'PENDING')",
            [deviceId, action],
        );
        const [[row]] = await connection.execute(
            `SELECT ${fields} ${from} WHERE ah.action_id = ?`,
            [result.insertId],
        );
        await connection.commit();
        return toHistoryRow(row);
    } catch (error) {
        try { await connection.rollback(); } catch { /* Giao dịch đã hoàn tất. */ }
        throw error;
    } finally {
        connection.release();
    }
}

module.exports = { listHistory, countHistory, recordHistory };
