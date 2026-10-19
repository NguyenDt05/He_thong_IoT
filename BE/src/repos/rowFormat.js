// Chuyển giờ MySQL ở múi giờ Việt Nam thành ISO và chuỗi yyyy/MM/dd HH:mm:ss.
function formatDateTime(value) {
    if (!value) return { iso: null, text: null };
    const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(String(value));
    if (!match) return { iso: null, text: null };
    const [, year, month, day, hour, minute, second] = match;
    return {
        iso: new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}+07:00`).toISOString(),
        text: `${year}/${month}/${day} ${hour}:${minute}:${second}`,
    };
}

module.exports = { formatDateTime };
