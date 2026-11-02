
const DEFAULT_ALERT_THRESHOLDS = Object.freeze({
    TEMPERATURE: 35,
    HUMIDITY: 80,
    LIGHT: 80,
});

const SENSOR_TYPES = Object.keys(DEFAULT_ALERT_THRESHOLDS);

function validateThresholds(input) {
    if (!input || typeof input !== "object" || Array.isArray(input)
        || Object.keys(input).length !== SENSOR_TYPES.length
        || !SENSOR_TYPES.every((type) => Object.hasOwn(input, type))) {
        const error = new Error("Cần nhập đủ ngưỡng nhiệt độ, độ ẩm và ánh sáng");
        error.code = "INVALID_THRESHOLDS";
        throw error;
    }
    const values = {};
    for (const type of SENSOR_TYPES) {
        const value = input[type];
        const min = type === "TEMPERATURE" ? -40 : 0;
        const max = type === "TEMPERATURE" ? 125 : 100;
        if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max
            || Math.abs(value - Math.round(value * 100) / 100) > 1e-8) {
            const error = new Error(`Ngưỡng ${type} phải nằm trong khoảng ${min}–${max} và có tối đa 2 chữ số thập phân`);
            error.code = "INVALID_THRESHOLDS";
            throw error;
        }
        values[type] = Math.round(value * 100) / 100;
    }
    return values;
}

function advanceAlertCounter(current, day, value, threshold) {
    const isAbove = value > threshold;
    const sameDay = String(current.alertDate).slice(0, 10) === day;
    return {
        alertDate: day,
        dailyCount: (sameDay ? Number(current.dailyCount) : 0) + (isAbove ? 1 : 0),
        isAbove,
    };
}

function applyThresholdChange(current, day, value, threshold) {
    const isAbove = value > threshold;
    const sameDay = String(current.alertDate).slice(0, 10) === day;
    return {
        alertDate: day,
        dailyCount: (sameDay ? Number(current.dailyCount) : 0) + (isAbove && !current.isAbove ? 1 : 0),
        isAbove,
    };
}

module.exports = { DEFAULT_ALERT_THRESHOLDS, SENSOR_TYPES, validateThresholds, advanceAlertCounter, applyThresholdChange };
