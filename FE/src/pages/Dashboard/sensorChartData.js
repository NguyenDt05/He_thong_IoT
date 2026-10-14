
export const SO_DIEM_HIEN_THI = 20;
export const KHOANG_TRONG_BIEU_DO_MS = 15000;

// Mỗi thời điểm chỉ có một điểm trên trục X; khoảng ngừng đo được ngắt nét.
export function taoDiemBieuDo(rows, types, gapMs = KHOANG_TRONG_BIEU_DO_MS) {
  const frames = new Map();
  for (const row of rows) {
    const time = Date.parse(row?.createdAt);
    if (!types.includes(row?.sensorType) || !Number.isFinite(time)
      || row.value === null || row.value === "" || !Number.isFinite(Number(row.value))) continue;
    const frame = frames.get(time) ?? { time };
    frame[row.sensorType] = Number(row.value);
    frames.set(time, frame);
  }

  const points = [...frames.values()].sort((a, b) => a.time - b.time);
  const display = [];
  for (const point of points) {
    const previous = display.at(-1);
    if (previous && point.time - previous.time > gapMs) {
      display.push({ time: previous.time + Math.floor((point.time - previous.time) / 2), gap: true });
    }
    display.push(point);
  }
  return { points, display };
}

// Xử lý dữ liệu cảm biến đưa lên biểu đồ
export function gopDuLieuBieuDo(hienTai, ketQua, types) {

  // 1. Tạo Map để loại bỏ bản ghi trùng
  const theoMau = new Map();

  // 2. Ghép bản đã lưu với bản API; không mất điểm khi mạch ngừng gửi.
  const cacDong = ketQua.flatMap((result, index) =>
    result.status === "fulfilled" && !result.value.fromCache
      ? [...hienTai.filter((dong) => dong.sensorType === types[index]),
          ...result.value.data.filter((dong) => dong?.sensorType === types[index])]
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
