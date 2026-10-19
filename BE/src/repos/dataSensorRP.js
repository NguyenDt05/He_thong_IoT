const db = require("../db");
const { formatDateTime } = require("./rowFormat");

function likePattern(value) {
    return `%${value.replace(/[!%_]/g, (character) => `!${character}`)}%`;
}

const SENSOR_TYPE_BY_CRITERION = {
    temperature: "TEMPERATURE",
    humidity: "HUMIDITY",
    light: "LIGHT",
};

// Mỗi tiêu chí khớp trực tiếp với một lựa chọn trên giao diện tìm kiếm.
function filters(key, criterion = "all") {
    const clauses = [];
    const params = [];

    const sensorType = SENSOR_TYPE_BY_CRITERION[criterion];
    if (sensorType) {
        clauses.push("s.sensor_type = ?");
        params.push(sensorType);
    }

    if (key) {
        const pattern = likePattern(key);
        if (sensorType) {
            clauses.push("CAST(ds.value AS CHAR) LIKE ? ESCAPE '!'");
            params.push(pattern);
        } else if (criterion === "datetime") {
            clauses.push("DATE_FORMAT(ds.created_at, '%Y/%m/%d %H:%i:%s') LIKE ? ESCAPE '!'");
            params.push(likePattern(key.replace(/,\s*/, " ")));
        } else {
            const conditions = [
                "CAST(ds.data_id AS CHAR) LIKE ? ESCAPE '!'",
                "s.sensor_name LIKE ? ESCAPE '!'",
                "s.sensor_type LIKE ? ESCAPE '!'",
                "(CASE s.sensor_type WHEN 'TEMPERATURE' THEN 'Cảm biến nhiệt độ' WHEN 'HUMIDITY' THEN 'Cảm biến độ ẩm' WHEN 'LIGHT' THEN 'Cảm biến ánh sáng' END) LIKE ? ESCAPE '!'",
                "DATE_FORMAT(ds.created_at, '%Y/%m/%d %H:%i:%s') LIKE ? ESCAPE '!'",
                "CAST(ds.value AS CHAR) LIKE ? ESCAPE '!'",
                "CONCAT_WS(' ', CAST(ds.value AS CHAR), s.unit) COLLATE utf8mb4_general_ci LIKE ? ESCAPE '!'",
            ];
            params.push(
                pattern,
                pattern,
                pattern,
                pattern,
                likePattern(key.replace(/,\s*/, " ")),
                pattern,
                pattern,
            );
            clauses.push(`(${conditions.join(" OR ")})`);
        }
    }
    return { where: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "", params };
}

const from = "FROM data_sensor ds JOIN sensors s ON s.sensor_id = ds.sensor_id";

// Lấy một trang bản ghi cảm biến theo thứ tự mới nhất.
async function layDuLieuCB_rp(key, criterion, limit, offset) {
    const { where, params } = filters(key, criterion);
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
async function countDuLieuCB_rp(key, criterion) {
    const { where, params } = filters(key, criterion);
    const [[row]] = await db.execute(`SELECT COUNT(*) AS total ${from} ${where}`, params);
    return Number(row.total);
}

module.exports = { layDuLieuCB_rp, countDuLieuCB_rp };
