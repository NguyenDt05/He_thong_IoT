import { memo, useEffect, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import MainLayout from "../../layouts/MainLayout";
import { layDuLieuCB_sv } from "../../services/dataSensorSV";
import { layThietBi_sv } from "../../services/deviceSV";
import { ghiLichSu_sv } from "../../services/historySV";
import { dinhdang } from "../../utils/formatDate";
import Thermometer from "../../components/Thermometer";
import HumidityIcon from "../../components/HumidityIcon";
import LightIcon from "../../components/LightIcon";
import { capNhatDuLieuMoPhong, CHU_KY_MO_PHONG_MS, layMauMoPhong, SO_DIEM_HIEN_THI } from "./mockData";
import { gopDuLieuBieuDo } from "./sensorChartData";
import "./Dashboard.css";

// Cấu hình cảm biến và thiết bị
const DS_CAM_BIEN = [
  { type: "TEMPERATURE", title: "Nhiệt độ", unit: "°C", tone: "temperature", chartColor: "#ec7656" },
  { type: "HUMIDITY", title: "Độ ẩm", unit: "%", tone: "humidity", chartColor: "#328fc8" },
  { type: "LIGHT", title: "Ánh sáng", unit: "%", tone: "light", chartColor: "#e0a62c" },
];

const KEY_DU_LIEU_CB = "iot-dashboard-latest-v1";
const KEY_TRANG_THAI_DEN = "iot-dashboard-light-ui-v1";
const THOI_GIAN_CAP_NHAT = 2000;
const SENSOR_MODE = import.meta.env.VITE_SENSOR_MODE?.toLowerCase() === "demo" ? "demo" : "real";
const LOAI_CAM_BIEN = DS_CAM_BIEN.map((cb) => cb.type);

const thangTemp = { //thang màu nhiệt độ
  min: -10,
  max: 60,
  colors: [
    { percent: 0, color: "#4B0082" },
    { percent: 10, color: "#0000FF" },
    { percent: 22, color: "#6495ED" },
    { percent: 36, color: "#00CED1" },
    { percent: 50, color: "#32CD32" },
    { percent: 62, color: "#FFD700" },
    { percent: 72, color: "#FF8C00" },
    { percent: 82, color: "#FF0000" },
    { percent: 100, color: "#8B0000" },
  ],
};
// Lấy màu tương ứng với nhiệt độ
function getTempColor(temp) {
  // 1. Kiểm tra nhiệt độ hợp lệ
  if (typeof temp !== "number" || !Number.isFinite(temp)) {
    return "#64748b";
  }

  // 2. Quy đổi nhiệt độ sang phần trăm (0-100%)
  const tempMin = thangTemp.min;
  const tempMax = thangTemp.max;

  const curr_percent = Math.min(100, Math.max(0,
    ((temp - tempMin) / (tempMax - tempMin)) * 100
  ));

  // 3. Tìm hai mốc màu bao quanh phần trăm nhiệt độ

  //lấy mảng màu và hàm tìm vtri mốc màu
  const dsMau = thangTemp.colors;
  const viTriMauTren = dsMau.findIndex(
    (mocMau) => mocMau.percent >= curr_percent
  );

    // Nếu nhiệt độ nhỏ hơn mốc màu đầu tiên, trả về màu đầu tiên
    // Nếu nhiệt độ lớn hơn mốc màu cuối cùng, trả về màu cuối cùng
  if (viTriMauTren === 0) return dsMau[0].color;
  if (viTriMauTren === -1) return dsMau.at(-1).color;

  // Lấy mốc màu dưới và trên
  const mauDuoi = dsMau[viTriMauTren - 1];
  const mauTren = dsMau[viTriMauTren];

  // 4. Tính tỷ lệ pha giữa hai màu. Xem màu hiện tại chiếm bao nhiêu phần trăm giữa hai mốc màu
  const tyLePha =
    (curr_percent - mauDuoi.percent) / (mauTren.percent - mauDuoi.percent);

  // 5. Pha từng kênh RGB của hai màu
  function phaKenhMau(viTri) {
    // lấy mã HEX từ chuỗi, chuỗi đang ở hệ thập lục phân (HEX), cần chuyển sang số nguyên
    const giaTriDuoi = parseInt(mauDuoi.color.slice(viTri, viTri + 2), 16);
    const giaTriTren = parseInt(mauTren.color.slice(viTri, viTri + 2), 16);

    const giaTriPha = Math.round(
      giaTriDuoi + (giaTriTren - giaTriDuoi) * tyLePha
    );

    //cuyển kết quả sang chuỗi HEX
    return giaTriPha.toString(16).padStart(2, "0");
  }

  // 6. Ghép ba kênh Red, Green, Blue thành mã HEX
  return `#${phaKenhMau(1)}${phaKenhMau(3)}${phaKenhMau(5)}`;
}
// localStorage
function docObject(key) {
  try {
    const text = window.localStorage.getItem(key);
    if (!text) {
      return {};
    }

    const duLieu = JSON.parse(text);
    if (duLieu && typeof duLieu === "object" && !Array.isArray(duLieu)) {
      return duLieu;
    }
  } catch {
    // Bỏ qua khi localStorage không khả dụng hoặc dữ liệu đã hỏng.
  }
  return {};
}

function luuObject(key, duLieu) {
  try {
    window.localStorage.setItem(key, JSON.stringify(duLieu));
  } catch {
    // Dữ liệu vẫn được hiển thị nếu trình duyệt không cho lưu localStorage.
  }
}

function docDuLieuCBGanNhat() {
  const daLuu = docObject(KEY_DU_LIEU_CB);
  const ketQua = {};

  DS_CAM_BIEN.forEach((cb) => {
    const dong = daLuu[cb.type];
    if (dong && dong.value !== null && dong.value !== "" && Number.isFinite(Number(dong.value))
      && Number.isFinite(Date.parse(dong.createdAt))) {
      ketQua[cb.type] = dong;
    }
  });

  return ketQua;
}

// Biểu đồ dữ liệu cảm biến
const SensorChart = memo(function SensorChart({ rows }) {
  const theoThoiGian = new Map(); // Nhóm các loại cảm biến theo thời gian.
  rows.forEach((dong) => {
    const time = Date.parse(dong.createdAt);
    if (!Number.isFinite(time)) {
      return;
    }

    const cacDiem = theoThoiGian.get(time) ?? [];
    const diem = cacDiem.find((item) => item[dong.sensorType] === undefined) ?? { time };
    diem[dong.sensorType] = Number(dong.value);
    if (!cacDiem.includes(diem)) cacDiem.push(diem);
    theoThoiGian.set(time, cacDiem);
  });

  // Nguồn dữ liệu đã giới hạn 20 bản ghi mỗi loại hoặc 20 bước mô phỏng.
  const duLieu = [...theoThoiGian.entries()].sort(([a], [b]) => a - b)
    .flatMap(([, cacDiem]) => cacDiem);

  if (duLieu.length === 0) {
    return <div className="chart-empty">Chưa có dữ liệu</div>;
  }

  const dsThoiGian = duLieu.map((dong) => dong.time);
  const thoiGianDau = Math.min(...dsThoiGian);
  const thoiGianCuoi = Math.max(...dsThoiGian);
  // Lấy 4 mốc thời gian để hiển thị trên trục X, gồm: đầu, 1/3, 2/3 và cuối
  const mocThoiGian = [...new Set([
    duLieu[0].time,
    duLieu[Math.floor((duLieu.length - 1) / 3)].time,
    duLieu[Math.floor(((duLieu.length - 1) * 2) / 3)].time,
    duLieu.at(-1).time,
])];

  return (
    <div className="dashboard-chart" role="img"
      aria-label="Biểu đồ nhiệt độ, độ ẩm và ánh sáng theo thời gian">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={duLieu} margin={{ top: 16, right: 4, bottom: 4, left: 4 }}>
          <CartesianGrid //Đường lưới
              yAxisId="temperature" //Gắn lưới với trục Y có ID temperature.
              vertical={false}      // Không vẽ lưới dọc.
              stroke="#e6eef2"    // Màu của đường lưới
              strokeDasharray="4 5" /> // Tạo nét đứt, 4px nét vẽ xen kẽ 5px khoảng trống.
          <XAxis // trục X hiển thị thời gian, nằm dưới cùng
            dataKey="time"
            type="number"
            domain={
              thoiGianDau === thoiGianCuoi
                ? [thoiGianDau - 1, thoiGianCuoi + 1]
                : [thoiGianDau, thoiGianCuoi]
            }
            ticks={mocThoiGian}
            interval={0} // Hiển thị tất cả các nhãn trục X, không bỏ qua nhãn nào.
            tickFormatter={(time) => dinhdang(time)}
            tickLine={false}
            axisLine={false}
            tick={{ fill: "#7b8c99", fontSize: 12 }}
          />
          <YAxis // trục Y cho nhiệt độ, hiển thị bên trái
            yAxisId="temperature"
            orientation="left"
            domain={[-10, 60]}
            ticks={[-10, 0, 10, 20, 30, 40, 50, 60]}
            allowDataOverflow // Cho phép dữ liệu vượt ra ngoài miền hiển thị, nhưng vẫn vẽ biểu đồ.
            tickFormatter={(value) => `${value}°C`} // Định dạng nhãn trục Y cho nhiệt độ
            tickLine={false}
            axisLine={false}
            tick={{ fill: "#7b8c99", fontSize: 11 }}
            width={60}
          />
          <YAxis // trục Y cho độ ẩm và ánh sáng, hiển thị bên phải
            yAxisId="percent"
            orientation="right"
            domain={[0, 100]}
            ticks={[0, 20, 40, 60, 80, 100]}
            allowDataOverflow
            tickFormatter={(value) => `${value}%`}
            tickLine={false}
            axisLine={false}
            tick={{ fill: "#7b8c99", fontSize: 11 }}
            width={60}
          />
          <Tooltip // Hiển thị thông tin khi rê chuột vào biểu đồ
            labelFormatter={(time) => dinhdang(time)}
            formatter={(value, name) => [
              `${Number(value).toLocaleString("vi-VN", {
                maximumFractionDigits: 2 // Giới hạn số chữ số thập phân hiển thị
              })} ${name === "Nhiệt độ" ? "°C" : "%"}`,
              name,
            ]}
          />
          <Legend // Hiển thị chú giải cho các đường biểu đồ
            verticalAlign="bottom"  //Đặt chú thích phía dưới biểu đồ
            align="center"          //Căn giữa chú thích theo chiều ngang
            height={36}
            iconType="plainline"    //Sử dụng biểu tượng đường thẳng
          />
          {DS_CAM_BIEN.map((sensor) => (
          <Line // Vẽ đường biểu đồ cho từng cảm biến
            key={sensor.type} // Sử dụng loại cảm biến làm khóa duy nhất
            dataKey={sensor.type} // Chọn trường dữ liệu tương ứng
            name={sensor.title}
            yAxisId={sensor.type === "TEMPERATURE" ? "temperature" : "percent"} // Gắn trục Y tương ứng
            type="linear" // Sử dụng đường thẳng tuyến tính để nối các điểm dữ liệu
            stroke={sensor.chartColor}
            strokeWidth={3}
            dot={{ r: 3, strokeWidth: 2 }} // Tùy chỉnh điểm dữ liệu: bán kính 3px, viền 2px
            activeDot={{ r: 5 }}           // Tùy chỉnh điểm dữ liệu khi rê chuột: bán kính 5px
            connectNulls
            isAnimationActive={false}      // Tắt hiệu ứng chuyển động khi vẽ
          />
        ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
});

// Dashboard chính
function Dashboard() {
  const [duLieuCB, setDuLieuCB] = useState(docDuLieuCBGanNhat);
  const [duLieuBieuDo, setDuLieuBieuDo] = useState(null);
  const [loiBieuDo, setLoiBieuDo] = useState(false);
  const [trangThaiCamBien, setTrangThaiCamBien] = useState({});
  const [dsThietBi, setDsThietBi] = useState(null);
  const [loiThietBi, setLoiThietBi] = useState(false);
  const [trangThaiDen, setTrangThaiDen] = useState(docObject(KEY_TRANG_THAI_DEN));
  const [idDangCapNhat, setIdDangCapNhat] = useState(null);
  const duLieuHienThi = SENSOR_MODE === "demo"
    ? Object.fromEntries((duLieuBieuDo ?? []).slice(-LOAI_CAM_BIEN.length)
      .map((dong) => [dong.sensorType, dong]))
    : duLieuCB;

  // Lấy dữ liệu cảm biến và tự cập nhật định kỳ
  useEffect(() => {
    let dangMoTrang = true;
    let dangTai = false;    // ktra xử lý request
    let interval;           // Lưu ID của bộ đếm cập nhật mỗi 2 giây
    let mauMoPhong = null;  // dl mẫu dể mô phỏng
    let buocMoPhong = 0;    // Số bước mô phỏng đã hiển thị
    let mocMoPhong = 0;     // mốc thời gian tạo điểm mô phỏng
    const controller = new AbortController();

    function themDiemMoPhong() { //tạo dl hiển thị ở demo
      if (!mauMoPhong) return;
      const buoc = buocMoPhong;
      const timestamp = mocMoPhong;
      const mau = mauMoPhong;
      setDuLieuBieuDo((hienTai) => capNhatDuLieuMoPhong(hienTai ?? [], mau, buoc, timestamp));
      buocMoPhong += 1;
      mocMoPhong += CHU_KY_MO_PHONG_MS;
    }

    async function capNhatCamBien() {
      if (dangTai) {
        return;
      }
      dangTai = true;
      const yeuCau = DS_CAM_BIEN.map((cb) => layDuLieuCB_sv(1, SO_DIEM_HIEN_THI, { type: cb.type }, controller.signal));
      const ketQua = await Promise.allSettled(yeuCau);
      dangTai = false;
      if (!dangMoTrang) {
        return;
      }

      const duLieuMoi = {};
      const trangThaiMoi = {};

      ketQua.forEach((result, index) => {
        const type = DS_CAM_BIEN[index].type;
        if (result.status === "rejected" || result.value.fromCache) {
          trangThaiMoi[type] = "error";
          return;
        }

        const dong = result.value.data?.find((item) =>
          item?.sensorType === type
          && Number.isFinite(Date.parse(item.createdAt))
          && item.value !== null
          && item.value !== ""
          && Number.isFinite(Number(item.value)),
        );
        if (!dong) {
          trangThaiMoi[type] = result.value.data.length === 0 ? "empty" : "error";
          return;
        }

        trangThaiMoi[type] = "ready";
        duLieuMoi[type] = dong;
      });
      setTrangThaiCamBien(trangThaiMoi);

      if (SENSOR_MODE === "real" && Object.keys(duLieuMoi).length > 0) {
        setDuLieuCB((hienTai) => {
          const cacMauMoi = Object.entries(duLieuMoi).filter(([type, dong]) => {
            const cu = hienTai[type];
            return !cu || Date.parse(dong.createdAt) > Date.parse(cu.createdAt)
              || (Date.parse(dong.createdAt) === Date.parse(cu.createdAt)
                && Number(dong.dataId) > Number(cu.dataId));
          });
          if (cacMauMoi.length === 0) {
            return hienTai;
          }

          const duLieu = { ...hienTai, ...Object.fromEntries(cacMauMoi) };
          luuObject(KEY_DU_LIEU_CB, duLieu);
          return duLieu;
        });
      }

      if (SENSOR_MODE === "real") {
        setLoiBieuDo(Object.values(trangThaiMoi).some((status) => status === "error"));
        if (ketQua.some((result) => result.status === "fulfilled" && !result.value.fromCache)) {
          setDuLieuBieuDo((hienTai) => gopDuLieuBieuDo(hienTai ?? [], ketQua, LOAI_CAM_BIEN));
        }
      } else if (!mauMoPhong) {
        try {
          mauMoPhong = layMauMoPhong(ketQua, LOAI_CAM_BIEN);
          mocMoPhong = Math.floor(Date.now() / CHU_KY_MO_PHONG_MS) * CHU_KY_MO_PHONG_MS;
          setLoiBieuDo(false);
          setTrangThaiCamBien(Object.fromEntries(LOAI_CAM_BIEN.map((type) => [type, "ready"])));
          themDiemMoPhong();
        } catch {
          setLoiBieuDo(true);
        }
      }
    }

    capNhatCamBien().finally(() => {
      if (!dangMoTrang) return;
      interval = window.setInterval(() => {
        if (SENSOR_MODE === "demo" && mauMoPhong) {
          themDiemMoPhong();
        } else {
          capNhatCamBien();
        }
      }, THOI_GIAN_CAP_NHAT);
    });
    return () => {
      dangMoTrang = false;
      controller.abort();
      window.clearInterval(interval);
    };
  }, []);

  // Lấy danh sách thiết bị
  useEffect(() => {
    const controller = new AbortController();

    async function layDanhSachThietBi() {
      try {
        const ketQua = await layThietBi_sv(controller.signal);
        const dsDen = ketQua.filter((tb) => Number.isSafeInteger(Number(tb.deviceId)));
        setDsThietBi(dsDen);
      } catch (error) {
        if (error.name !== "AbortError") {
          setDsThietBi([]);
          setLoiThietBi(true);
        }
      }
    }

    layDanhSachThietBi();
    return () => controller.abort();
  }, []);

  // Bật/tắt đèn và ghi lịch sử
  async function batTatDen(thietBi) {
    if (!thietBi || idDangCapNhat !== null) {
      return;
    }

    const id = thietBi.deviceId;
    const seBat = trangThaiDen[id] !== true;
    setTrangThaiDen((hienTai) => {
      const trangThaiMoi = { ...hienTai, [id]: seBat };
      luuObject(KEY_TRANG_THAI_DEN, trangThaiMoi);
      return trangThaiMoi;
    });
    setIdDangCapNhat(id);

    try {
      await ghiLichSu_sv(id, seBat ? "ON" : "OFF");
    } catch {
      // Công tắc vẫn hiển thị trạng thái trên giao diện nếu chưa lưu được lịch sử.
    } finally {
      setIdDangCapNhat(null);
    }
  }

  // Giao diện
  return (
    <MainLayout title="Dashboard" description="Tổng quan dữ liệu cảm biến và trạng thái thiết bị">
      <div className="dashboard">
        {/* Ba ô nhiệt độ, độ ẩm, ánh sáng. */}
        <section className="dashboard-section">
          <div className="dashboard-grid">
            {DS_CAM_BIEN.map((cb) => {
              const trangThai = trangThaiCamBien[cb.type] ?? "loading";
              const moiNhat = duLieuHienThi[cb.type];
              const temperature = cb.type === "TEMPERATURE" && moiNhat ? Number(moiNhat.value) : null;
              const humidity = cb.type === "HUMIDITY" && moiNhat ? Number(moiNhat.value) : null;
              const light = cb.type === "LIGHT" && moiNhat ? Number(moiNhat.value) : null;
              const sensorStyle = cb.type === "TEMPERATURE"
                ? { "--sensor-color": getTempColor(temperature) }
                : undefined;

              return (
                // Tên và chỉ số xếp dọc bên trái, biểu tượng căn giữa bên phải.
                <article className={`dashboard-card sensor-card ${cb.tone}`} key={cb.type} style={sensorStyle}>
                  <div className="sensor-card-info">
                    <span className="sensor-card-label">{cb.title}</span>
                    <div className="sensor-reading">
                      <strong>{moiNhat ? Number(moiNhat.value).toLocaleString("vi-VN", { maximumFractionDigits: 1 }) : "--"}</strong>
                      <span>{moiNhat?.unit || cb.unit}</span>
                    </div>
                    <span className="sensor-card-meta" role="status">
                      {trangThai === "loading" && "Đang tải dữ liệu..."}
                      {trangThai === "error" && "Lỗi tải dữ liệu cảm biến"}
                      {trangThai === "empty" && (moiNhat ? "Chưa có dữ liệu mới" : "Chưa có dữ liệu")}
                      {moiNhat && <span className="sensor-card-time">Dữ liệu lúc {dinhdang(moiNhat.createdAt)}</span>}
                    </span>
                  </div>
                  <div className="sensor-card-icon">
                    {cb.type === "TEMPERATURE" && <Thermometer temperature={temperature} scale={thangTemp} />}
                    {cb.type === "HUMIDITY" && <HumidityIcon humidity={humidity} />}
                    {cb.type === "LIGHT" && <LightIcon light={light} />}
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {/* Cụm điều khiển đèn: mỗi thiết bị có một thẻ và một công tắc bật/tắt. */}
        <section className="dashboard-section">
          <div className="dashboard-grid dashboard-light-grid">
            {(dsThietBi ?? []).map((thietBi) => {
              const id = thietBi.deviceId;
              const dangBat = trangThaiDen[id] === true;
              const tenDen = thietBi.deviceName || `Đèn ${id}`;
              const status = dangBat ? "Đang bật" : "Đang tắt";

              return (
                // Thẻ đèn hiển thị biểu tượng, tên, trạng thái và nút gạt điều khiển.
                <article className={`dashboard-card light-card${dangBat ? " is-on" : ""}`} key={id}>
                  <span className="light-icon" aria-hidden="true">💡</span>
                  <div className="light-card-details">
                    <h3>{tenDen}</h3>
                    <span>{status}</span>
                  </div>
                  <button className="light-switch" type="button" role="switch"
                    aria-label={`Bật tắt ${tenDen}`} aria-checked={dangBat}
                    disabled={idDangCapNhat !== null} onClick={() => batTatDen(thietBi)}>
                    <span />
                  </button>
                </article>
              );
            })}
            {/* Dòng thông báo khi chưa có thẻ thiết bị để hiển thị. */}
            {(dsThietBi === null || dsThietBi.length === 0) && (
              <p className="dashboard-device-empty" role="status">
                {dsThietBi === null ? "Đang tải thiết bị..." : loiThietBi ? "Lỗi tải thiết bị. Không thể kết nối API." : "Chưa có thiết bị"}
              </p>
            )}
          </div>
        </section>

        {/* Một biểu đồ chung cho ba loại cảm biến, có chú giải ở dưới. */}
        <section className="dashboard-section">
          <div className="dashboard-card chart-card">
            <h2 className="chart-title">Biểu đồ dữ liệu</h2>
            {loiBieuDo || duLieuBieuDo === null || duLieuBieuDo.length === 0
              ? <div className="chart-empty" role="status">
                  {loiBieuDo
                    ? "Lỗi tải dữ liệu cảm biến. Không thể kết nối API."
                    : Object.values(trangThaiCamBien).length === 0
                    ? "Đang tải dữ liệu..."
                    : Object.values(trangThaiCamBien).every((status) => status === "error")
                      ? "Lỗi tải dữ liệu cảm biến. Không thể kết nối API."
                      : "Chưa có dữ liệu"}
                </div>
              : <SensorChart rows={duLieuBieuDo} />}
          </div>
        </section>
      </div>
    </MainLayout>
  );
}

export default Dashboard;
