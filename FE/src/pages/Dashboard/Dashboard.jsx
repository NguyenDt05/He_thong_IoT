import { memo, useEffect, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import MainLayout from "../../layouts/MainLayout";
import { layDuLieuCB_sv } from "../../services/dataSensorSV";
import { layThietBi_sv } from "../../services/deviceSV";
import { ghiLichSu_sv } from "../../services/historySV";
import { layTrangThaiMach_sv } from "../../services/hardwareSV";
import { dinhdang } from "../../utils/formatDate";
import Thermometer from "../../components/Thermometer";
import HumidityIcon from "../../components/HumidityIcon";
import LightIcon from "../../components/LightIcon";
import { gopDuLieuBieuDo, SO_DIEM_HIEN_THI, taoDiemBieuDo } from "./sensorChartData";
import "./Dashboard.css";

// Cấu hình cảm biến và thiết bị
const DS_CAM_BIEN = [
  { type: "TEMPERATURE", title: "Nhiệt độ", unit: "°C", tone: "temperature", chartColor: "#ec7656" },
  { type: "HUMIDITY", title: "Độ ẩm", unit: "%", tone: "humidity", chartColor: "#328fc8" },
  { type: "LIGHT", title: "Ánh sáng", unit: "%", tone: "light", chartColor: "#e0a62c" },
];

const KEY_DU_LIEU_CB = "iot-dashboard-latest-real-v2";
const KEY_BIEU_DO = "iot-dashboard-chart-real-v1";
const THOI_GIAN_CAP_NHAT = 2000;
const THOI_GIAN_KIEM_TRA_MACH = 1000;
const THOI_GIAN_CHO_TRANG_THAI_MACH = 3000;
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

function docBieuDoGanNhat() {
  try {
    const rows = JSON.parse(window.localStorage.getItem(KEY_BIEU_DO));
    return Array.isArray(rows) ? rows.filter((row) =>
      LOAI_CAM_BIEN.includes(row?.sensorType)
      && row.value !== null && row.value !== "" && Number.isFinite(Number(row.value))
      && Number.isFinite(Date.parse(row.createdAt))) : [];
  } catch {
    return [];
  }
}

// Biểu đồ dữ liệu cảm biến
const SensorChart = memo(function SensorChart({ rows }) {
  const { points, display } = taoDiemBieuDo(rows, LOAI_CAM_BIEN);
  if (points.length === 0) {
    return <div className="chart-empty">Chưa có dữ liệu</div>;
  }

  const ngayDau = dinhdang(points[0].time).slice(0, 10);
  const nhieuNgay = points.some((point) => dinhdang(point.time).slice(0, 10) !== ngayDau);
  function nhanThoiGian(time) {
    const full = dinhdang(time);
    return nhieuNgay ? `${full.slice(0, 5)} ${full.slice(11, 16)}` : full.slice(11);
  }
  // Lấy tối đa bốn mốc thật để chú thích; các điểm đo luôn được dàn đều.
  const mocDuKien = [...new Set([
    points[0].time,
    points[Math.floor((points.length - 1) / 3)].time,
    points[Math.floor(((points.length - 1) * 2) / 3)].time,
    points.at(-1).time,
])];
  const nhanDaCo = new Set();
  const mocThoiGian = mocDuKien.filter((time) => {
    const nhan = nhanThoiGian(time);
    if (nhanDaCo.has(nhan)) return false;
    nhanDaCo.add(nhan);
    return true;
  });

  return (
    <div className="dashboard-chart" role="img"
      aria-label="Biểu đồ nhiệt độ, độ ẩm và ánh sáng theo thời gian">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={display} margin={{ top: 16, right: 4, bottom: 4, left: 4 }}>
          <CartesianGrid //Đường lưới
              yAxisId="temperature" //Gắn lưới với trục Y có ID temperature.
              vertical={false}      // Không vẽ lưới dọc.
              stroke="#e6eef2"    // Màu của đường lưới
              strokeDasharray="4 5" /> // Tạo nét đứt, 4px nét vẽ xen kẽ 5px khoảng trống.
          <XAxis // Các lần đo cách đều trên màn hình; thời gian thật nằm ở nhãn và tooltip.
            dataKey="time"
            type="category"
            ticks={mocThoiGian}
            interval="preserveStartEnd"
            minTickGap={16}
            tickFormatter={nhanThoiGian}
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
            type="monotone" // Làm mềm nét vẽ; các giá trị đo không bị thay đổi.
            stroke={sensor.chartColor}
            strokeWidth={2.5}
            dot={points.filter((point) => point[sensor.type] !== undefined).length === 1
              ? { r: 3, strokeWidth: 2 } : false}
            activeDot={{ r: 4 }}
            connectNulls={false} // Không vẽ xuyên qua khoảng thời gian không có số đo.
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
  const [duLieuBieuDo, setDuLieuBieuDo] = useState(docBieuDoGanNhat);
  const [trangThaiMach, setTrangThaiMach] = useState("loading");
  const [dsThietBi, setDsThietBi] = useState(null);
  const [loiThietBi, setLoiThietBi] = useState(false);
  const [idDangCapNhat, setIdDangCapNhat] = useState(null);
  const [loiDieuKhien, setLoiDieuKhien] = useState("");
  const mocThoiGianDuLieu = Object.values(duLieuCB).map((dong) => Date.parse(dong.createdAt));
  const thoiGianDuLieu = mocThoiGianDuLieu.length > 0 ? Math.max(...mocThoiGianDuLieu) : null;

  useEffect(() => {
    luuObject(KEY_BIEU_DO, duLieuBieuDo);
  }, [duLieuBieuDo]);

  // Kiểm tra kết nối độc lập với các request dữ liệu để một request cảm biến
  // chậm không thể giữ nguyên trạng thái "đã kết nối" trên giao diện.
  useEffect(() => {
    let dangMoTrang = true;
    let timer;
    let controller;

    async function capNhatTrangThaiMach() {
      controller = new AbortController();
      const requestTimeout = window.setTimeout(
        () => controller.abort(), THOI_GIAN_CHO_TRANG_THAI_MACH,
      );
      try {
        const ketQua = await layTrangThaiMach_sv(controller.signal);
        if (dangMoTrang) {
          setTrangThaiMach(ketQua.connected ? "connected" : "disconnected");
        }
      } catch {
        if (dangMoTrang) setTrangThaiMach("error");
      } finally {
        window.clearTimeout(requestTimeout);
        if (dangMoTrang) {
          timer = window.setTimeout(capNhatTrangThaiMach, THOI_GIAN_KIEM_TRA_MACH);
        }
      }
    }

    capNhatTrangThaiMach();
    return () => {
      dangMoTrang = false;
      controller?.abort();
      window.clearTimeout(timer);
    };
  }, []);

  // Lấy dữ liệu cảm biến và tự cập nhật định kỳ
  useEffect(() => {
    let dangMoTrang = true;
    let dangTai = false;    // ktra xử lý request
    let interval;           // Lưu ID của bộ đếm cập nhật mỗi 2 giây
    const controller = new AbortController();

    async function capNhatCamBien() {
      if (dangTai) {
        return;
      }
      dangTai = true;
      const yeuCau = DS_CAM_BIEN.map((cb) => layDuLieuCB_sv(
        1,
        SO_DIEM_HIEN_THI,
        { criterion: cb.type.toLowerCase() },
        controller.signal,
      ));
      const ketQua = await Promise.allSettled(yeuCau);
      dangTai = false;
      if (!dangMoTrang) {
        return;
      }

      const duLieuMoi = {};

      ketQua.forEach((result, index) => {
        const type = DS_CAM_BIEN[index].type;
        if (result.status === "rejected" || result.value.fromCache) {
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
          return;
        }

        duLieuMoi[type] = dong;
      });

      if (Object.keys(duLieuMoi).length > 0) {
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

      if (ketQua.some((result) => result.status === "fulfilled" && !result.value.fromCache)) {
        setDuLieuBieuDo((hienTai) => gopDuLieuBieuDo(hienTai, ketQua, LOAI_CAM_BIEN));
      }
    }

    capNhatCamBien().finally(() => {
      if (!dangMoTrang) return;
      interval = window.setInterval(() => {
        capNhatCamBien();
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
    let interval;
    let dangTai = false;

    async function layDanhSachThietBi() {
      if (dangTai) return;
      dangTai = true;
      try {
        const ketQua = await layThietBi_sv(controller.signal);
        const dsDen = ketQua.filter((tb) => Number.isSafeInteger(Number(tb.deviceId)));
        setDsThietBi(dsDen);
        setLoiThietBi(false);
      } catch (error) {
        if (error.name !== "AbortError") {
          setLoiThietBi(true);
        }
      } finally {
        dangTai = false;
      }
    }

    layDanhSachThietBi();
    interval = window.setInterval(layDanhSachThietBi, THOI_GIAN_CAP_NHAT);
    return () => {
      controller.abort();
      window.clearInterval(interval);
    };
  }, []);

  // Bật/tắt đèn và ghi lịch sử
  async function batTatDen(thietBi) {
    if (!thietBi || idDangCapNhat !== null || thietBi.pendingActionId || trangThaiMach !== "connected") {
      return;
    }

    const id = thietBi.deviceId;
    const seBat = thietBi.status !== "ON";
    setIdDangCapNhat(id);
    setLoiDieuKhien("");

    try {
      // Chỉ tạo lệnh PENDING; trạng thái thật sẽ đến từ devices sau khi mạch xác nhận.
      const [ketQuaLenh] = await Promise.allSettled([
        ghiLichSu_sv(id, seBat ? "ON" : "OFF"),
        new Promise((resolve) => window.setTimeout(resolve, 1000)),
      ]);
      if (ketQuaLenh.status === "rejected") throw ketQuaLenh.reason;
      setDsThietBi((hienTai) => hienTai?.map((item) =>
        item.deviceId === id ? { ...item, pendingActionId: ketQuaLenh.value.id } : item));
      try {
        setDsThietBi(await layThietBi_sv());
      } catch {
        // Lệnh đã được xếp; lần đồng bộ thiết bị tiếp theo sẽ cập nhật trạng thái.
      }
    } catch {
      setLoiDieuKhien("Không thể gửi lệnh đến mạch. Vui lòng thử lại.");
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
          <div className="dashboard-sensor-header">
            <span>{thoiGianDuLieu === null ? "Chưa có dữ liệu" : `Cập nhật: ${dinhdang(thoiGianDuLieu)}`}</span>
            {trangThaiMach !== "connected" && trangThaiMach !== "loading" && (
              <span className="dashboard-hardware-error" role="alert">Lỗi kết nối phần cứng</span>
            )}
          </div>
          <div className="dashboard-grid">
            {DS_CAM_BIEN.map((cb) => {
              const moiNhat = duLieuCB[cb.type];
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
              const dangBat = thietBi.status === "ON";
              const dangCho = idDangCapNhat === id || Boolean(thietBi.pendingActionId);
              const tenDen = thietBi.deviceName || `Đèn ${id}`;
              const status = dangCho ? "Đang chờ mạch..." : dangBat ? "Đang bật" : "Đang tắt";

              return (
                // Thẻ đèn hiển thị biểu tượng, tên, trạng thái và nút gạt điều khiển.
                <article className={`dashboard-card light-card${dangBat ? " is-on" : ""}`} key={id}>
                  <span className="light-icon" aria-hidden="true">💡</span>
                  <div className="light-card-details">
                    <h3>{tenDen}</h3>
                    <span className={`light-card-status${dangCho ? " is-loading" : ""}`} role="status">{status}</span>
                  </div>
                  <button className="light-switch" type="button" role="switch"
                    aria-label={`Bật tắt ${tenDen}`} aria-checked={dangBat} aria-busy={dangCho}
                    disabled={idDangCapNhat !== null || Boolean(thietBi.pendingActionId)
                      || trangThaiMach !== "connected" || loiThietBi}
                    onClick={() => batTatDen(thietBi)}>
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
            {loiDieuKhien && <p className="dashboard-device-empty" role="alert">{loiDieuKhien}</p>}
          </div>
        </section>

        {/* Một biểu đồ chung cho ba loại cảm biến, có chú giải ở dưới. */}
        <section className="dashboard-section">
          <div className="dashboard-card chart-card">
            <h2 className="chart-title">Biểu đồ dữ liệu</h2>
            {duLieuBieuDo.length === 0
              ? <div className="chart-empty" role="status">
                  {trangThaiMach === "loading" ? "Đang tải dữ liệu..." : "Chưa có dữ liệu"}
                </div>
              : <SensorChart rows={duLieuBieuDo} />}
          </div>
        </section>
      </div>
    </MainLayout>
  );
}

export default Dashboard;
