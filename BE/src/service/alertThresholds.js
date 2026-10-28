
const ALERT_THRESHOLDS = Object.freeze({
    TEMPERATURE: 35,
    HUMIDITY: 80,
    LIGHT: 80,
});

function advanceAlertCounter(current, day, value, threshold) {
    const isAbove = value > threshold;
    const sameDay = String(current.alertDate).slice(0, 10) === day;
    return {
        alertDate: day,
        dailyCount: (sameDay ? Number(current.dailyCount) : 0) + (isAbove && !current.isAbove ? 1 : 0),
        isAbove,
    };
}

module.exports = { ALERT_THRESHOLDS, advanceAlertCounter };
