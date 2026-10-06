import { useEffect, useState } from "react";
// Sử dụng Recharts để vẽ ba cảm biến trên cùng một biểu đồ.
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import MainLayout from "../../layouts/MainLayout";
import { layDuLieuCB_sv } from "../../services/dataSensorSV";
import { layThietBi_sv } from "../../services/deviceSV";
import { ghiLichSu_sv } from "../../services/historySV";
import { dinhdang } from "../../utils/formatDate";
import { getMockChartRows } from "./chartData";
import Thermometer from "../../components/Thermometer";
import HumidityIcon from "../../components/HumidityIcon";
import LightIcon from "../../components/LightIcon";
import "./Dashboard.css";

// Cấu hình cảm biến và thiết bị
const DS_CAM_BIEN = [
  { type: "TEMPERATURE", title: "Nhiệt độ", unit: "°C", tone: "temperature", chartColor: "#ec7656" },
  { type: "HUMIDITY", title: "Độ ẩm", unit: "%", tone: "humidity", chartColor: "#328fc8" },
  { type: "LIGHT", title: "Ánh sáng", unit: "%", tone: "light", chartColor: "#e0a62c" },
];
const DEN_MOI = { deviceId: 3, deviceName: "Đèn 3", chiTrenGiaoDien: true };
const DEN_MAC_DINH = [{ deviceId: 1, deviceName: "Đèn 1" }, { deviceId: 2, deviceName: "Đèn 2" }, DEN_MOI];
const KEY_DU_LIEU_CB = "iot-dashboard-latest-v1";
const KEY_TRANG_THAI_DEN = "iot-dashboard-light-ui-v1";
const THOI_GIAN_CAP_NHAT = 15000;
const NHIP_MO_PHONG = 500;

const temperatureScale = {
  min: -5,
  max: 45,
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

function getTemperatureColor(temperature) {
  if (typeof temperature !== "number" || !Number.isFinite(temperature)) return "#64748b";

  const percent = Math.min(100, Math.max(0,
    ((temperature - temperatureScale.min) / (temperatureScale.max - temperatureScale.min)) * 100));
  const colors = temperatureScale.colors;
  const upperIndex = colors.findIndex((stop) => stop.percent >= percent);
  if (upperIndex === 0) return colors[0].color;
  if (upperIndex === -1) return colors.at(-1).color;

  const lower = colors[upperIndex - 1];
  const upper = colors[upperIndex];
  const ratio = (percent - lower.percent) / (upper.percent - lower.percent);
  const channel = (index) => {
    const start = Number.parseInt(lower.color.slice(index, index + 2), 16);
    const end = Number.parseInt(upper.color.slice(index, index + 2), 16);
    return Math.round(start + (end - start) * ratio).toString(16).padStart(2, "0");
  };
  return `#${channel(1)}${channel(3)}${channel(5)}`;
}

function buocNgauNhien(nhoNhat, lonNhat) {
  const huong = Math.random() < 0.5 ? -1 : 1;
  return huong * (nhoNhat + Math.random() * (lonNhat - nhoNhat));
}

function phanXaTrongKhoang(value, min, max) {
  if (value < min) return min + (min - value);
  if (value > max) return max - (value - max);
  return value;
}

// localStorage
function docObject(key) {
  try {
    const text = window.localStorage.getItem(key);
    if (!text) return {};

    const duLieu = JSON.parse(text);
    if (duLieu && typeof duLieu === "object" && !Array.isArray(duLieu)) return duLieu;
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
    if (dong && Number.isFinite(Number(dong.value))) ketQua[cb.type] = dong;
  });

  return ketQua;
}

// Biểu đồ dữ liệu cảm biến
function SensorChart({ rows }) {
  const duLieu = rows.map((dong) => ({
    time: Date.parse(dong.createdAt),
    TEMPERATURE: Number(dong.TEMPERATURE),
    HUMIDITY: Number(dong.HUMIDITY),
    LIGHT: Number(dong.LIGHT),
  })).filter((dong) => Number.isFinite(dong.time));

  if (duLieu.length === 0) {
    return <div className="chart-empty">Chưa có dữ liệu</div>;
  }

  const dsThoiGian = duLieu.map((dong) => dong.time);
  const thoiGianDau = Math.min(...dsThoiGian);
  const thoiGianCuoi = Math.max(...dsThoiGian);
  const hienGiay = thoiGianCuoi - thoiGianDau < 60_000;
  const mocThoiGian = [...new Set([
    duLieu[0].time,
    duLieu[Math.floor((duLieu.length - 1) / 2)].time,
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
              strokeDasharray="4 5" /> //Tạo nét đứt, 4px nét vẽ xen kẽ 5px khoảng trống.
          <XAxis dataKey="time" type="number"
            domain={thoiGianDau === thoiGianCuoi
              ? [thoiGianDau - 1, thoiGianCuoi + 1]
              : [thoiGianDau, thoiGianCuoi]}
            ticks={mocThoiGian} tickFormatter={(time) => dinhdang(time).slice(11, hienGiay ? 19 : 16)}
            tickLine={false} axisLine={false} tick={{ fill: "#7b8c99", fontSize: 12 }} />
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
            width={50}
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
            width={45}
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
            isAnimationActive={false}      // Tắt hiệu ứng chuyển động khi vẽ
          />
        ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// Dashboard chính
function Dashboard() {
  const [duLieuCB, setDuLieuCB] = useState(docDuLieuCBGanNhat);
  const [dangMoPhong, setDangMoPhong] = useState(import.meta.env.DEV);
  const [lichSuMoPhong, setLichSuMoPhong] = useState(() => [{
    createdAt: new Date().toISOString(),
    TEMPERATURE: 25,
    HUMIDITY: 60,
    LIGHT: 50,
  }]);
  const [dsThietBi, setDsThietBi] = useState(DEN_MAC_DINH);
  const [trangThaiThietBi, setTrangThaiThietBi] = useState("loading");
  const [trangThaiDen, setTrangThaiDen] = useState(docObject(KEY_TRANG_THAI_DEN));
  const [idDangCapNhat, setIdDangCapNhat] = useState(null);

  useEffect(() => {
    if (!dangMoPhong) return undefined;

    const interval = window.setInterval(() => {
      const thayDoi = {
        TEMPERATURE: buocNgauNhien(2, 9),
        HUMIDITY: buocNgauNhien(2, 10),
        LIGHT: buocNgauNhien(3, 14),
      };
      const createdAt = new Date().toISOString();
      setLichSuMoPhong((lichSu) => {
        const cuoi = lichSu.at(-1);
        const moi = {
          createdAt,
          TEMPERATURE: phanXaTrongKhoang(cuoi.TEMPERATURE + thayDoi.TEMPERATURE, temperatureScale.min, temperatureScale.max),
          HUMIDITY: phanXaTrongKhoang(cuoi.HUMIDITY + thayDoi.HUMIDITY, 0, 100),
          LIGHT: phanXaTrongKhoang(cuoi.LIGHT + thayDoi.LIGHT, 0, 100),
        };
        return [...lichSu.slice(-11), moi];
      });
    }, NHIP_MO_PHONG);
    return () => window.clearInterval(interval);
  }, [dangMoPhong]);

  // Lấy dữ liệu cảm biến và tự cập nhật định kỳ
  useEffect(() => {
    if (dangMoPhong) return undefined;

    let dangMoTrang = true;
    const controller = new AbortController();

    async function capNhatCamBien() {
      const requests = DS_CAM_BIEN.map((cb) => layDuLieuCB_sv(1, 1, { type: cb.type }, controller.signal));
      const ketQua = await Promise.allSettled(requests);
      if (!dangMoTrang) return;

      const duLieuMoi = {};

      ketQua.forEach((result, index) => {
        const type = DS_CAM_BIEN[index].type;
        if (result.status === "rejected") return;

        const dong = result.value.data?.[0];
        if (!dong || !Number.isFinite(Number(dong.value))) return;

        duLieuMoi[type] = dong;
      });

      if (Object.keys(duLieuMoi).length > 0) {
        setDuLieuCB((hienTai) => {
          const duLieu = { ...hienTai, ...duLieuMoi };
          luuObject(KEY_DU_LIEU_CB, duLieu);
          return duLieu;
        });
      }
    }

    capNhatCamBien();
    const interval = window.setInterval(capNhatCamBien, THOI_GIAN_CAP_NHAT);
    return () => {
      dangMoTrang = false;
      controller.abort();
      window.clearInterval(interval);
    };
  }, [dangMoPhong]);

  // Lấy danh sách thiết bị
  useEffect(() => {
    const controller = new AbortController();

    async function layDanhSachThietBi() {
      try {
        const ketQua = await layThietBi_sv(controller.signal);
        const dsDen = ketQua.filter((tb) => Number.isSafeInteger(Number(tb.deviceId)));
        setDsThietBi(dsDen.some((tb) => Number(tb.deviceId) === DEN_MOI.deviceId)
          ? dsDen
          : [...dsDen, DEN_MOI]);
        setTrangThaiThietBi("ready");
      } catch (error) {
        if (error.name !== "AbortError") setTrangThaiThietBi("offline");
      }
    }

    layDanhSachThietBi();
    return () => controller.abort();
  }, []);

  // Bật/tắt đèn và ghi lịch sử
  async function batTatDen(thietBi) {
    if (!thietBi || idDangCapNhat !== null) return;

    const id = thietBi.deviceId;
    const seBat = trangThaiDen[id] !== true;
    setTrangThaiDen((hienTai) => {
      const trangThaiMoi = { ...hienTai, [id]: seBat };
      luuObject(KEY_TRANG_THAI_DEN, trangThaiMoi);
      return trangThaiMoi;
    });
    if (thietBi.chiTrenGiaoDien) return;
    setIdDangCapNhat(id);

    try {
      await ghiLichSu_sv(id, seBat ? "ON" : "OFF");
      window.dispatchEvent(new Event("iot-history-updated"));
    } catch {
      // Công tắc vẫn hiển thị trạng thái trên giao diện nếu chưa lưu được lịch sử.
    } finally {
      setIdDangCapNhat(null);
    }
  }

  // Biểu đồ
  const duLieuBieuDo = dangMoPhong ? lichSuMoPhong : getMockChartRows();
  const duLieuHienThi = dangMoPhong
    ? Object.fromEntries(DS_CAM_BIEN.map((cb) => [cb.type, {
      value: lichSuMoPhong.at(-1)[cb.type],
      unit: cb.unit,
    }]))
    : duLieuCB;

  // Giao diện
  return (
    <MainLayout title="Dashboard" description="Tổng quan dữ liệu cảm biến và trạng thái thiết bị">
      <div className="dashboard">
        {/* Cụm thẻ cảm biến: tiêu đề và ba ô nhiệt độ, độ ẩm, ánh sáng. */}
        <section className="dashboard-section">
          <div className="dashboard-section-heading">
            <h2>Dữ liệu cảm biến</h2>
            <button className="sensor-demo-toggle" type="button" aria-pressed={dangMoPhong}
              onClick={() => setDangMoPhong((hienTai) => !hienTai)}>
              {dangMoPhong ? "Tắt mô phỏng" : "Mô phỏng cảm biến"}
            </button>
          </div>
          <div className="dashboard-grid">
            {DS_CAM_BIEN.map((cb) => {
              const moiNhat = duLieuHienThi[cb.type];
              const temperature = cb.type === "TEMPERATURE" && moiNhat ? Number(moiNhat.value) : null;
              const humidity = cb.type === "HUMIDITY" && moiNhat ? Number(moiNhat.value) : null;
              const light = cb.type === "LIGHT" && moiNhat ? Number(moiNhat.value) : null;
              const sensorStyle = cb.type === "TEMPERATURE"
                ? { "--sensor-color": getTemperatureColor(temperature) }
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
                  </div>
                  <div className="sensor-card-icon">
                    {cb.type === "TEMPERATURE" && <Thermometer temperature={temperature} scale={temperatureScale} />}
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
          <div className="dashboard-section-heading"><h2>Điều khiển đèn</h2></div>
          <div className="dashboard-grid dashboard-light-grid">
            {dsThietBi.map((thietBi) => {
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
                    <span>{status}{thietBi.chiTrenGiaoDien}</span>
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
            {dsThietBi.length === 0 && (
              <p className="dashboard-device-empty">
                {trangThaiThietBi === "offline" ? "Không thể tải danh sách thiết bị" : "Đang tải thiết bị..."}
              </p>
            )}
          </div>
        </section>

        {/* Một biểu đồ chung cho ba loại cảm biến, có chú giải ở dưới. */}
        <section className="dashboard-section">
          <div className="dashboard-section-heading"><h2>Biểu đồ dữ liệu</h2></div>
          <div className="dashboard-card chart-card">
            <SensorChart rows={duLieuBieuDo} />
          </div>
        </section>
      </div>
    </MainLayout>
  );
}

export default Dashboard;
