
const db = require("../db");
const { formatDateTime } = require("./rowFormat");

// Cấu hình thời gian chờ mạch xác nhận lệnh (giây).
const timeoutMs = Number(process.env.HARDWARE_COMMAND_TIMEOUT_MS);
const timeoutSeconds = Number.isFinite(timeoutMs) && timeoutMs > 0 ? Math.ceil(timeoutMs / 1000) : 30;

// Các thành phần SQL dùng chung.
const localNow = "CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+07:00')";

const from = `
    FROM action_history ah
    JOIN devices d ON d.device_id = ah.device_id
    LEFT JOIN users u ON u.user_id = ah.user_id
`;

// Lệnh PENDING quá hạn được hiển thị là FAILED.
const effectiveStatus = `
    CASE
        WHEN ah.status = 'PENDING'
         AND ah.created_at < DATE_SUB(${localNow}, INTERVAL ${timeoutSeconds} SECOND)
        THEN 'FAILED'
        ELSE ah.status
    END
`;

const fields = `
    ah.action_id AS id,
    ah.device_id AS deviceId,
    d.device_name AS deviceName,
    u.full_name AS username,
    ah.action,
    ${effectiveStatus} AS status,
    ah.created_at AS createdAtLocal
`;

// Chuẩn hóa dữ liệu lịch sử trả về Frontend.
function toHistoryRow({ createdAtLocal, ...row }) {
    const { iso, text } = formatDateTime(createdAtLocal);

    return {
        ...row,
        createdAt: iso,
        createdAtText: text,
    };
}

// Chuẩn hóa từ khóa tiếng Việt để tìm kiếm thao tác.
function normalizeKey(value) {
    return value.toLocaleLowerCase("vi-VN")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d");
}

// Escape ký tự đặc biệt khi tìm kiếm bằng LIKE.
function likePattern(value) {
    return `%${value.replace(/[!%_]/g, char => `!${char}`)}%`;
}

// Xây dựng điều kiện tìm kiếm và bộ lọc.
function filters(key, deviceId, action, status) {
    const clauses = [];
    const params = [];

    if (deviceId !== null) {
        clauses.push("ah.device_id = ?");
        params.push(deviceId);
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
        const term = normalizeKey(key);

        const search = [
            "d.device_name LIKE ? ESCAPE '!'",
            "u.full_name LIKE ? ESCAPE '!'",
            "DATE_FORMAT(ah.created_at, '%Y/%m/%d %H:%i:%s') LIKE ? ESCAPE '!'",
            "LOWER(ah.action) LIKE ? ESCAPE '!'",
            `LOWER(${effectiveStatus}) LIKE ? ESCAPE '!'`,
        ];

        params.push(
            likePattern(key),
            likePattern(key),
            likePattern(key.replace(/,\s*/g, " ")),
            likePattern(term),
            likePattern(term)
        );

        if (term === "bat") {
            search.push("ah.action = 'ON'");
        }

        if (term === "tat") {
            search.push("ah.action = 'OFF'");
        }

        clauses.push(`(${search.join(" OR ")})`);
    }

    return {
        where: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "",
        params,
    };
}

// Lấy danh sách lịch sử theo bộ lọc, mới nhất trước.
async function listHistory(key, deviceId, action, status, limit, offset) {
    const { where, params } = filters(key, deviceId, action, status);

    const [rows] = await db.execute(
        `SELECT ${fields} ${from} ${where}
         ORDER BY ah.created_at DESC, ah.action_id DESC
         LIMIT ? OFFSET ?`,
        [...params, limit, offset]
    );

    return rows.map(toHistoryRow);
}

// Đếm tổng số bản ghi khớp với bộ lọc.
async function countHistory(key, deviceId, action, status) {
    const { where, params } = filters(key, deviceId, action, status);

    const [[row]] = await db.execute(
        `SELECT COUNT(*) AS total ${from} ${where}`,
        params
    );

    return Number(row.total);
}

// Ghi lệnh PENDING, không cho gửi lệnh mới khi lệnh cũ chưa hết hạn.
async function recordHistory(deviceId, action) {
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const [[device]] = await connection.execute(
            "SELECT device_id FROM devices WHERE device_id = ? FOR UPDATE",
            [deviceId]
        );

        if (!device) {
            await connection.rollback();
            return null;
        }

        const [[pending]] = await connection.execute(
            `SELECT action_id FROM action_history
             WHERE device_id = ? AND status = 'PENDING'
               AND created_at >= DATE_SUB(${localNow}, INTERVAL ? SECOND)
             LIMIT 1`,
            [deviceId, timeoutSeconds]
        );

        if (pending) {
            await connection.rollback();

            const error = new Error("Thiết bị đang chờ mạch xác nhận lệnh trước");
            error.code = "COMMAND_PENDING";
            throw error;
        }

        const [result] = await connection.execute(
            `INSERT INTO action_history (user_id, device_id, action, status)
             VALUES (NULL, ?, ?, 'PENDING')`,
            [deviceId, action]
        );

        const [[row]] = await connection.execute(
            `SELECT ${fields} ${from} WHERE ah.action_id = ?`,
            [result.insertId]
        );

        await connection.commit();
        return toHistoryRow(row);

    } catch (error) {
        try {
            await connection.rollback();
        } catch {
        }
        throw error;
    } finally {
        connection.release();
    }
}

module.exports = { listHistory, countHistory, recordHistory };
