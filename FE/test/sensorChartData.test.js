import assert from "node:assert/strict";
import test from "node:test";
import { gopDuLieuBieuDo, SO_DIEM_HIEN_THI, taoDiemBieuDo } from "../src/pages/Dashboard/sensorChartData.js";

const types = ["TEMPERATURE", "HUMIDITY", "LIGHT"];
const baseTime = Date.parse("2026-10-13T00:00:00.000Z");

function result(data, fromCache = false) {
  return { status: "fulfilled", value: { data, fromCache } };
}

test("biểu đồ chỉ dùng bản ghi thật và giữ tối đa 20 điểm mỗi loại", () => {
  const responses = types.map((type, typeIndex) => result(Array.from({ length: 22 }, (_, index) => ({
    dataId: typeIndex * 100 + index + 1,
    sensorType: type,
    value: typeIndex * 20 + index,
    createdAt: new Date(baseTime - index * 1000 - typeIndex * 100).toISOString(),
  }))));
  const first = gopDuLieuBieuDo([], responses, types);
  assert.equal(first.length, SO_DIEM_HIEN_THI * types.length);
  types.forEach((type) => assert.equal(first.filter((row) => row.sensorType === type).length, SO_DIEM_HIEN_THI));
  assert.equal(first.find((row) => row.dataId === 1).createdAt, responses[0].value.data[0].createdAt);
  assert.strictEqual(gopDuLieuBieuDo(first, responses, types), first);
  assert.strictEqual(gopDuLieuBieuDo(first, types.map(() => result([], true)), types), first);
  assert.strictEqual(gopDuLieuBieuDo(first, types.map(() => ({ status: "rejected" })), types), first);
  assert.strictEqual(gopDuLieuBieuDo(first, types.map(() => result([])), types), first);
});

test("bản ghi mới làm biểu đồ tiến lên, bản API cũ không làm mất dữ liệu cuối", () => {
  const old = { dataId: 1, sensorType: "TEMPERATURE", value: 24, createdAt: new Date(baseTime).toISOString() };
  const newer = { dataId: 2, sensorType: "TEMPERATURE", value: 25, createdAt: new Date(baseTime + 2000).toISOString() };
  const combined = gopDuLieuBieuDo([old], [result([newer]), result([]), result([])], types);
  assert.deepEqual(combined.map((row) => row.dataId), [1, 2]);
  assert.strictEqual(gopDuLieuBieuDo(combined, [result([old]), result([]), result([])], types), combined);
});

test("điểm cùng thời gian được ghép, khoảng ngừng đo dài được ngắt nét", () => {
  const rows = [
    { sensorType: "TEMPERATURE", value: 25, createdAt: new Date(baseTime).toISOString() },
    { sensorType: "HUMIDITY", value: 60, createdAt: new Date(baseTime).toISOString() },
    { sensorType: "LIGHT", value: 40, createdAt: new Date(baseTime).toISOString() },
    { sensorType: "TEMPERATURE", value: 26, createdAt: new Date(baseTime + 2000).toISOString() },
    { sensorType: "TEMPERATURE", value: 27, createdAt: new Date(baseTime + 56 * 60 * 60 * 1000).toISOString() },
  ];
  const { points, display } = taoDiemBieuDo(rows, types);
  assert.equal(points.length, 3);
  assert.deepEqual([points[0].TEMPERATURE, points[0].HUMIDITY, points[0].LIGHT], [25, 60, 40]);
  assert.equal(display.length, 4);
  assert.equal(display[2].gap, true);
  assert.equal(display[2].TEMPERATURE, undefined);
  assert.equal(display[3].TEMPERATURE, 27);
});
