import assert from "node:assert/strict";
import test from "node:test";
import { capNhatDuLieuMoPhong, CHU_KY_MO_PHONG_MS, DU_LIEU_MAU, layMauMoPhong } from "../src/pages/Dashboard/mockData.js";
import { gopDuLieuBieuDo } from "../src/pages/Dashboard/sensorChartData.js";

const types = ["TEMPERATURE", "HUMIDITY", "LIGHT"];
const baseTime = Date.parse("2026-10-13T00:00:00.000Z");

function result(data, fromCache = false) {
  return { status: "fulfilled", value: { data, fromCache } };
}

test("DEMO lấy tối đa 15 giá trị BE và quay về đầu sau bước 15", () => {
  const responses = types.map((type) => result(Array.from({ length: 18 }, (_, index) => ({
    sensorType: type,
    value: index,
    createdAt: new Date(baseTime - index * 1000).toISOString(),
  }))));
  const mau = layMauMoPhong(responses, types);
  assert.deepEqual(mau.TEMPERATURE, Array.from({ length: 15 }, (_, index) => 14 - index));

  let lichSu = [];
  for (let step = 0; step < 16; step += 1) {
    lichSu = capNhatDuLieuMoPhong(lichSu, mau, step, baseTime + step * CHU_KY_MO_PHONG_MS);
    assert.equal(lichSu.length, Math.min(step + 1, 10) * types.length);
  }
  assert.equal(lichSu.at(-1).value, mau.LIGHT[0]);
  assert.deepEqual(lichSu.slice(-3).map((row) => row.value), types.map((type) => mau[type][0]));
  assert.equal(new Set(lichSu.slice(-3).map((row) => row.createdAt)).size, 1);
  for (let index = 3; index < lichSu.length; index += 3) {
    assert.equal(Date.parse(lichSu[index].createdAt) - Date.parse(lichSu[index - 3].createdAt), 2000);
  }
});

test("DEMO dùng 15 giá trị cố định chỉ khi DB không có bản ghi", () => {
  const mau = layMauMoPhong(types.map(() => result([])), types);
  types.forEach((type) => assert.deepEqual(mau[type], DU_LIEU_MAU[type]));
  assert.throws(() => layMauMoPhong(types.map(() => result([], true)), types));
});

test("REAL giữ createdAt, tối đa 10 bản ghi mỗi loại và không tự sinh dữ liệu", () => {
  const responses = types.map((type, typeIndex) => result(Array.from({ length: 12 }, (_, index) => ({
    dataId: typeIndex * 100 + index + 1,
    sensorType: type,
    value: typeIndex * 20 + index,
    createdAt: new Date(baseTime - index * 1000 - typeIndex * 100).toISOString(),
  }))));
  const first = gopDuLieuBieuDo([], responses, types);
  assert.equal(first.length, 30);
  types.forEach((type) => assert.equal(first.filter((row) => row.sensorType === type).length, 10));
  assert.equal(first.find((row) => row.dataId === 1).createdAt, responses[0].value.data[0].createdAt);
  assert.strictEqual(gopDuLieuBieuDo(first, responses, types), first);
  assert.strictEqual(gopDuLieuBieuDo(first, types.map(() => result([], true)), types), first);
  assert.strictEqual(gopDuLieuBieuDo(first, types.map(() => ({ status: "rejected" })), types), first);
  assert.deepEqual(gopDuLieuBieuDo(first, types.map(() => result([])), types), []);
});
