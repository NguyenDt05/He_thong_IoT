
export const MOCK_DEVICES = [
  { deviceId: 1, deviceName: "Đèn 1", chiTrenGiaoDien: true },
  { deviceId: 2, deviceName: "Đèn 2", chiTrenGiaoDien: true },
  { deviceId: 3, deviceName: "Đèn 3", chiTrenGiaoDien: true },
];

// 20 bộ giá trị cố định, được tái sử dụng tuần hoàn
const DU_LIEU_MAU = {
  TEMPERATURE: [
    27.4, 27.1, 26.8, 26.5, 26.2,
    26.7, 27.6, 28.8, 29.5, 30.1,
    29.8, 29.2, 28.7, 28.1, 27.8,
    27.3, 26.9, 26.6, 27.0, 27.5,
  ],
  HUMIDITY: [
    68, 70, 72, 74, 73,
    69, 65, 61, 58, 60,
    63, 66, 70, 73, 75,
    72, 69, 67, 65, 68,
  ],
  LIGHT: [
    12, 8, 5, 4, 7,
    18, 35, 54, 72, 81,
    85, 78, 65, 49, 36,
    24, 16, 10, 8, 12,
  ],
};

const CHU_KY_MS = 2000;
const SO_DIEM_HIEN_THI = 10;
const SO_MAU = DU_LIEU_MAU.TEMPERATURE.length;

// Lấy bộ giá trị theo vị trí, tự động quay về 0 sau 19
function layGiaTri(index, timestamp) {
  const i = ((index % SO_MAU) + SO_MAU) % SO_MAU;

  return {
    createdAt: new Date(timestamp).toISOString(),
    TEMPERATURE: DU_LIEU_MAU.TEMPERATURE[i],
    HUMIDITY: DU_LIEU_MAU.HUMIDITY[i],
    LIGHT: DU_LIEU_MAU.LIGHT[i],
  };
}

// Khởi tạo 10 điểm gần nhất, đồng bộ theo mốc 2 giây
export function taoDuLieuMoPhong() {
  const hienTai = Date.now();
  const mocCuoi = Math.floor(hienTai / CHU_KY_MS) * CHU_KY_MS;
  const indexCuoi = Math.floor(mocCuoi / CHU_KY_MS);

  return Array.from({ length: SO_DIEM_HIEN_THI }, (_, i) => {
    const timestamp =
      mocCuoi - (SO_DIEM_HIEN_THI - 1 - i) * CHU_KY_MS;

    const index = indexCuoi - (SO_DIEM_HIEN_THI - 1 - i);

    return layGiaTri(index, timestamp);
  });
}

// Cập nhật khi đến chu kỳ mới, không sinh điểm trùng
export function capNhatDuLieuMoPhong(lichSu) {
  if (!Array.isArray(lichSu) || lichSu.length === 0) {
    return taoDuLieuMoPhong();
  }

  const hienTai = Date.now();
  const mocMoi = Math.floor(hienTai / CHU_KY_MS) * CHU_KY_MS;
  const mocCu = Date.parse(lichSu.at(-1).createdAt);

  if (!Number.isFinite(mocCu)) {
    return taoDuLieuMoPhong();
  }

  if (mocMoi <= mocCu) {
    return lichSu;
  }

  if (mocMoi - mocCu >= SO_DIEM_HIEN_THI * CHU_KY_MS) {
    return taoDuLieuMoPhong();
  }

  const ketQua = [...lichSu];

  // Bù các chu kỳ bị bỏ lỡ khi timer chạy chậm
  for (
    let timestamp = mocCu + CHU_KY_MS;
    timestamp <= mocMoi;
    timestamp += CHU_KY_MS
  ) {
    const index = Math.floor(timestamp / CHU_KY_MS);
    ketQua.push(layGiaTri(index, timestamp));
  }

  return ketQua.slice(-SO_DIEM_HIEN_THI);
}
