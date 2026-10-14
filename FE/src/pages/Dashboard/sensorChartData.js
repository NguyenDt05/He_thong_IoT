
import { SO_DIEM_HIEN_THI } from "./mockData.js";

// Xử lý dữ liệu cảm biến đưa lên biểu đồ
export function gopDuLieuBieuDo(hienTai, ketQua, types) {

  // 1. Tạo Map để loại bỏ bản ghi trùng
  const theoMau = new Map();

  // 2. Lấy dữ liệu API; nếu API lỗi thì giữ dữ liệu cũ của loại đó
  const cacDong = ketQua.flatMap((result, index) =>
    result.status === "fulfilled" && !result.value.fromCache
      ? result.value.data.filter(
          (dong) => dong?.sensorType === types[index]
        )
      : hienTai.filter(
          (dong) => dong.sensorType === types[index]
        )
  );

  // 3. Kiểm tra bản ghi hợp lệ và loại trùng bằng Map
  cacDong.forEach((dong) => {
    const time = Date.parse(dong.createdAt);
    const value = Number(dong.value);

    // Bỏ qua bản ghi sai loại, sai thời gian hoặc giá trị
    if (
      !types.includes(dong.sensorType)
      || !Number.isFinite(time)
      || dong.value === null
      || dong.value === ""
      || !Number.isFinite(value)
    ) return;

    // Ưu tiên dataId; nếu thiếu thì dùng loại + thời gian
    const key = dong.dataId == null
      ? `${dong.sensorType}:${time}`
      : `${dong.sensorType}:${dong.dataId}`;

    theoMau.set(key, dong);
  });

  // 4. Lấy 20 bản ghi mới nhất của mỗi loại cảm biến
  const moiNhat = types.flatMap((type) =>
    [...theoMau.values()]
      .filter((dong) => dong.sensorType === type)
      .sort((a, b) =>
        Date.parse(b.createdAt) - Date.parse(a.createdAt)
        || Number(b.dataId ?? 0) - Number(a.dataId ?? 0)
      )
      .slice(0, SO_DIEM_HIEN_THI)
  )
  // 5. Sắp xếp lại toàn bộ theo thời gian tăng dần để vẽ
  .sort((a, b) =>
    Date.parse(a.createdAt) - Date.parse(b.createdAt)
    || a.sensorType.localeCompare(b.sensorType)
    || Number(a.dataId ?? 0) - Number(b.dataId ?? 0)
  );

  // 6. So sánh dữ liệu mới và cũ để tránh cập nhật thừa
  const khongThayDoi =
    moiNhat.length === hienTai.length
    && moiNhat.every((dong, index) =>
      dong.dataId === hienTai[index].dataId
      && dong.createdAt === hienTai[index].createdAt
      && dong.value === hienTai[index].value
    );

  // Không thay đổi thì giữ mảng cũ, ngược lại trả mảng mới
  return khongThayDoi ? hienTai : moiNhat;
}
