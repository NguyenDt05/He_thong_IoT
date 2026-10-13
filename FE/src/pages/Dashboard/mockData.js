// Chỉ dùng khi BE xác nhận loại cảm biến này chưa có bản ghi.
export const DU_LIEU_MAU = {
  TEMPERATURE: [27.4, 27.1, 26.8, 26.5, 26.2, 26.7, 27.6, 28.8, 29.5, 30.1, 29.8, 29.2, 28.7, 28.1, 27.8],
  HUMIDITY: [68, 70, 72, 74, 73, 69, 65, 61, 58, 60, 63, 66, 70, 73, 75],
  LIGHT: [12, 8, 5, 4, 7, 18, 35, 54, 72, 81, 85, 78, 65, 49, 36],
};

export const CHU_KY_MO_PHONG_MS = 2000;
const SO_DIEM_HIEN_THI = 10;

// API trả bản ghi mới nhất trước; phát lại từ bản cũ đến bản mới.
export function layMauMoPhong(ketQua, types) {
  return Object.fromEntries(types.map((type, index) => {
    const result = ketQua[index];
    if (result.status !== "fulfilled" || result.value.fromCache) {
      throw new Error(`Không thể lấy mẫu cảm biến ${type}`);
    }

    const rows = result.value.data;
    if (!Array.isArray(rows)) {
      throw new Error(`Dữ liệu cảm biến ${type} không hợp lệ`);
    }
    if (rows.length === 0) return [type, DU_LIEU_MAU[type]];

    const values = rows.filter((row) => row?.sensorType === type
      && row.value !== null && row.value !== "" && Number.isFinite(Number(row.value)))
      .slice(0, 15).map((row) => Number(row.value)).reverse();
    if (values.length === 0) {
      throw new Error(`Dữ liệu cảm biến ${type} không hợp lệ`);
    }
    return [type, values];
  }));
}

// Một bước phát chung cho mọi loại; thời gian do Dashboard tạo, không lấy từ DB.
export function capNhatDuLieuMoPhong(lichSu, mau, buoc, timestamp) {
  const createdAt = new Date(timestamp).toISOString();
  const diemMoi = Object.entries(mau).map(([sensorType, values]) => ({
    sensorType,
    value: values[buoc % values.length],
    createdAt,
  }));
  return [...lichSu, ...diemMoi].slice(-SO_DIEM_HIEN_THI * Object.keys(mau).length);
}
