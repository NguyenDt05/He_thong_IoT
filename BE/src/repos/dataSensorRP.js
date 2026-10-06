const db = require("../db");
const { formatDateTime } = require("./rowFormat");

function likePattern(value) {
    return `%${value.replace(/[!%_]/g, (character) => `!${character}`)}%`;
}

// Tạo điều kiện tìm kiếm theo trường được chọn; giữ bộ lọc type cũ cho API hiện tại.
function filters(key, type, field = "all") {
    const clauses = [];
    const params = [];
    if (type) {
        clauses.push("s.sensor_type = ?");
        params.push(type);
    }
    if (key) {
        const conditions = [];
        const pattern = likePattern(key);
        if (field === "all") {
            conditions.push("CAST(ds.data_id AS CHAR) LIKE ? ESCAPE '!'");
            conditions.push("s.sensor_name LIKE ? ESCAPE '!'");
            params.push(pattern, pattern);
        }
        if (field === "all" || field === "type") {
            conditions.push("s.sensor_type LIKE ? ESCAPE '!'");
            conditions.push("(CASE s.sensor_type WHEN 'TEMPERATURE' THEN 'Cảm biến nhiệt độ' WHEN 'HUMIDITY' THEN 'Cảm biến độ ẩm' WHEN 'LIGHT' THEN 'Cảm biến ánh sáng' END) LIKE ? ESCAPE '!'");
            params.push(pattern, pattern);
        }
        if (field === "all" || field === "datetime") {
            conditions.push("DATE_FORMAT(ds.created_at, '%d/%m/%Y %H:%i:%s') LIKE ? ESCAPE '!'");
            params.push(likePattern(key.replace(/,\s*/, " ")));
        }
        if (field === "all" || field === "value") {
            conditions.push("CAST(ds.value AS CHAR) LIKE ? ESCAPE '!'");
            params.push(pattern);
        }
        if (field === "all") {
            conditions.push("CONCAT_WS(' ', CAST(ds.value AS CHAR), s.unit) COLLATE utf8mb4_general_ci LIKE ? ESCAPE '!'");
            params.push(pattern);
        }
        if (conditions.length) clauses.push(`(${conditions.join(" OR ")})`);
    }
    return { where: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "", params };
}

const from = "FROM data_sensor ds JOIN sensors s ON s.sensor_id = ds.sensor_id";

// Lấy một trang bản ghi cảm biến theo thứ tự mới nhất.
async function layDuLieuCB_rp(key, type, field, limit, offset) {
    const { where, params } = filters(key, type, field);
    const [rows] = await db.execute(
        `SELECT ds.data_id AS dataId, s.sensor_id AS sensorId,
                s.sensor_name AS sensorName, s.sensor_type AS sensorType,
                s.unit, ds.value, ds.created_at AS createdAtLocal
         ${from} ${where}
         ORDER BY ds.created_at DESC, ds.data_id DESC LIMIT ? OFFSET ?`,
        [...params, limit, offset],
    );
    return rows.map(({ createdAtLocal, ...row }) => {
        const { iso, text } = formatDateTime(createdAtLocal);
        return { ...row, value: Number(row.value), createdAt: iso, createdAtText: text };
    });
}

// Đếm tổng số bản ghi với cùng điều kiện lọc để tính phân trang.
async function countDuLieuCB_rp(key, type, field) {
    const { where, params } = filters(key, type, field);
    const [[row]] = await db.execute(`SELECT COUNT(*) AS total ${from} ${where}`, params);
    return Number(row.total);
}

module.exports = { layDuLieuCB_rp, countDuLieuCB_rp };
