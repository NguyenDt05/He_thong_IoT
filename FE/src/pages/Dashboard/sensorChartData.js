// Giữ tối đa 10 bản ghi thật gần nhất của từng loại, kể cả khi thời gian các loại lệch nhau.
export function gopDuLieuBieuDo(hienTai, ketQua, types) {
  const theoMau = new Map();
  const cacDong = ketQua.flatMap((result, index) =>
    result.status === "fulfilled" && !result.value.fromCache
      ? result.value.data.filter((dong) => dong?.sensorType === types[index])
      : hienTai.filter((dong) => dong.sensorType === types[index]));

  cacDong.forEach((dong) => {
    const time = Date.parse(dong.createdAt);
    const value = Number(dong.value);
    if (!types.includes(dong.sensorType) || !Number.isFinite(time)
      || dong.value === null || dong.value === "" || !Number.isFinite(value)) return;

    const key = dong.dataId == null
      ? `${dong.sensorType}:${time}`
      : `${dong.sensorType}:${dong.dataId}`;
    theoMau.set(key, dong);
  });

  const moiNhat = types.flatMap((type) => [...theoMau.values()]
    .filter((dong) => dong.sensorType === type)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)
      || Number(b.dataId ?? 0) - Number(a.dataId ?? 0))
    .slice(0, 10))
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)
      || a.sensorType.localeCompare(b.sensorType)
      || Number(a.dataId ?? 0) - Number(b.dataId ?? 0));

  const khongThayDoi = moiNhat.length === hienTai.length && moiNhat.every((dong, index) =>
    dong.dataId === hienTai[index].dataId
    && dong.createdAt === hienTai[index].createdAt
    && dong.value === hienTai[index].value,
  );
  return khongThayDoi ? hienTai : moiNhat;
}
