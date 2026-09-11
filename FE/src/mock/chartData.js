// Các chuỗi số minh họa để vẽ ba loại biểu đồ trên Dashboard.
const SERIES = {
  TEMPERATURE: [27.4, 27.1, 26.8, 26.5, 26.2, 26.7, 27.6, 28.8, 29.5, 30.1, 29.6, 28.9],
  HUMIDITY: [68, 70, 72, 74, 73, 69, 65, 61, 58, 60, 63, 66],
  LIGHT: [12, 8, 5, 4, 7, 18, 35, 54, 72, 81, 67, 43],
};

// Chuyển chuỗi số được chọn thành các điểm có mốc thời gian cho biểu đồ.
export function getMockChartRows(type) {
  const values = SERIES[type] ?? [];
  const lastHour = Math.floor(Date.now() / 3_600_000) * 3_600_000;
  return values.map((value, index) => ({
    value,
    createdAt: new Date(lastHour - (values.length - 1 - index) * 3_600_000).toISOString(),
  }));
}
