// Thiết lập ngôn ngữ và múi giờ thống nhất cho thời gian hiển thị trên giao diện.
export const LOCALE = "vi-VN";
export const TIME_ZONE = "Asia/Ho_Chi_Minh";

// Chuyển thời gian API thành yyyy/MM/dd HH:mm:ss theo múi giờ Việt Nam.
export function dinhdang(date) {
  const parts = new Intl.DateTimeFormat(LOCALE, {
    timeZone: TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date(date));
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}/${values.month}/${values.day} ${values.hour}:${values.minute}:${values.second}`;
}
