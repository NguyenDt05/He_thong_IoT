import { memo, useEffect, useState } from "react";
import { Pencil, X, Thermometer as ThermometerGlyph, Droplet, Sun, Lightbulb, ChevronUp, ChevronDown, Wifi, WifiOff, Zap } from "lucide-react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import MainLayout from "../../layouts/MainLayout";
import { layDuLieuCB_sv } from "../../services/dataSensorSV";
import { layThietBi_sv } from "../../services/deviceSV";
import { ghiLichSu_sv } from "../../services/historySV";
import { layTrangThaiMach_sv } from "../../services/hardwareSV";
import { layCanhBao_sv } from "../../services/alertSV";
import { dinhdang } from "../../utils/formatDate";
import { formatSensorValue } from "../../utils/formatSensorValue";
import LightGauge from "../../components/LightGauge";
import { gopDuLieuBieuDo, SO_DIEM_HIEN_THI, taoDiemBieuDo } from "./sensorChartData";
import "./Dashboard.css";
import "./DashboardLayout.css";

// Cấu hình cảm biến và thiết bị
const DS_CAM_BIEN = [
  { type: "TEMPERATURE", title: "Nhiệt độ", unit: "°C", tone: "temperature", chartColor: "#ec7656", icon: ThermometerGlyph },
  { type: "HUMIDITY", title: "Độ ẩm", unit: "%", tone: "humidity", chartColor: "#328fc8", icon: Droplet },
  { type: "LIGHT", title: "Ánh sáng", unit: "%", tone: "light", chartColor: "#e0a62c", icon: Sun },
];

const KEY_DU_LIEU_CB = "iot-dashboard-latest-real-v2";
const KEY_BIEU_DO = "iot-dashboard-chart-real-v1";
const THOI_GIAN_CAP_NHAT = 2000;
const THOI_GIAN_KIEM_TRA_MACH = 1000;
const THOI_GIAN_CAP_NHAT_CANH_BAO = 10000;
const THOI_GIAN_CHO_TRANG_THAI_MACH = 3000;
const LOAI_CAM_BIEN = DS_CAM_BIEN.map((cb) => cb.type);

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
              `${formatSensorValue(value)} ${name === "Nhiệt độ" ? "°C" : "%"}`,
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
  const [thoiDiemKiemTra, setThoiDiemKiemTra] = useState(Date.now);
  const [dsThietBi, setDsThietBi] = useState(null);
  const [loiThietBi, setLoiThietBi] = useState(false);
  const [idDangCapNhat, setIdDangCapNhat] = useState(null);
  const [loiDieuKhien, setLoiDieuKhien] = useState("");
  const [canhBao, setCanhBao] = useState(null);
  const [dangChinhSuaNguong, setDangChinhSuaNguong] = useState(false);
  const [nguongNhap, setNguongNhap] = useState({});
  const mocThoiGianDuLieu = Object.values(duLieuCB).map((dong) => Date.parse(dong.createdAt));
  const thoiGianDuLieu = mocThoiGianDuLieu.length > 0 ? Math.max(...mocThoiGianDuLieu) : null;

  useEffect(() => {
    luuObject(KEY_BIEU_DO, duLieuBieuDo);
  }, [duLieuBieuDo]);

  useEffect(() => {
    const controller = new AbortController();
    let dangTai = false;
    async function capNhatCanhBao() {
      if (dangTai) return;
      dangTai = true;
      try {
        setCanhBao(await layCanhBao_sv(controller.signal));
      } catch {

      } finally {
        dangTai = false;
      }
    }
    capNhatCanhBao();
    const interval = window.setInterval(capNhatCanhBao, THOI_GIAN_CAP_NHAT_CANH_BAO);
    return () => {
      controller.abort();
      window.clearInterval(interval);
    };
  }, []);

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
          setThoiDiemKiemTra(Date.now());
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

  // Khối hiển thị một cảm biến: tên, chỉ số, số lần vượt ngưỡng và biểu tượng.
  function hienThiCamBien(cb, className) {
    const moiNhat = duLieuCB[cb.type];
    const temperature = cb.type === "TEMPERATURE" && moiNhat ? Number(moiNhat.value) : null;
    const light = cb.type === "LIGHT" && moiNhat ? Number(moiNhat.value) : null;
    const vuotNguong = trangThaiMach === "connected"
      && moiNhat && thoiDiemKiemTra - Date.parse(moiNhat.createdAt) <= 10000
      && Number(moiNhat.value) > canhBao?.thresholds?.[cb.type];

    const Icon = cb.type === "LIGHT" ? Zap : cb.icon;

    return (
      <article className={`${className} ${cb.tone}`} key={cb.type}>
        <div className="env-head">
          <span className="env-glyph" aria-hidden="true"><Icon size={16} strokeWidth={2} /></span>
          <span className="sensor-card-label">{cb.title}</span>
        </div>
        {cb.type === "LIGHT" ? <LightGauge value={light} /> : <div className="env-body">
          <div className="sensor-reading">
            <strong>{temperature > 0 ? "+" : ""}{formatSensorValue(moiNhat?.value)}</strong>
            <span>{moiNhat?.unit || cb.unit}</span>
          </div>
        </div>}
        {cb.type === "TEMPERATURE" && (
          <div className="env-temperature-ruler" aria-hidden="true">
            {Array.from({ length: 11 }, (_, index) => (
              <i key={index} className={temperature !== null && index >= 10 - Math.round(Math.max(0, Math.min(1, (temperature + 10) / 70)) * 10) ? "is-filled" : ""} />
            ))}
          </div>
        )}
        {cb.type === "HUMIDITY" && <div className="env-humidity-detail" aria-hidden="true"><ChevronUp size={15} /><ChevronDown size={15} /></div>}
        <span className={`sensor-alert-count${vuotNguong ? " is-alert" : ""}`}>
          {`Vượt ngưỡng hôm nay: ${canhBao?.counts?.[cb.type] ?? "—"} lần`}
        </span>
      </article>
    );
  }

  // Giao diện
  return (
    <MainLayout className="dashboard-layout" title="Dashboard"
      description="Tổng quan dữ liệu cảm biến và trạng thái thiết bị"
      headerActions={
        <span className={`dashboard-connection ${trangThaiMach}`} role="status">
          <i aria-hidden="true" />
          {trangThaiMach === "connected" ? "Đang kết nối" : trangThaiMach === "loading" ? "Đang kiểm tra" : "Mất kết nối"}
        </span>
      }>
      <div className="dashboard">
        {/* Cột chính: cụm cảm biến phía trên và biểu đồ phía dưới. */}
        <div className="dashboard-main">
          <section className="dashboard-section">
            <div className="env-grid">
              {/* Hai chỉ số nhiệt độ và độ ẩm xếp dọc trong cột trái. */}
              <div className="env-left">
                {DS_CAM_BIEN.filter((cb) => cb.type !== "LIGHT")
                  .map((cb) => hienThiCamBien(cb, "dashboard-card env-card"))}
              </div>
              {/* Đồng hồ ánh sáng chiếm chiều cao của cả hai thẻ bên trái. */}
              <div className="env-light">
                {DS_CAM_BIEN.filter((cb) => cb.type === "LIGHT")
                  .map((cb) => hienThiCamBien(cb, "dashboard-card env-card env-light-card"))}
              </div>
            </div>
          </section>

          <div className="dashboard-card chart-card">
            <div className="dashboard-chart-heading">
              <div>
                <h2 className="chart-title">Biểu đồ</h2>
                <p>Nhiệt độ, độ ẩm và ánh sáng theo thời gian</p>
              </div>
              <span className="dashboard-chart-period">{SO_DIEM_HIEN_THI} số đo gần nhất</span>
            </div>
            {duLieuBieuDo.length === 0
              ? <div className="chart-empty" role="status">
                  {trangThaiMach === "loading" ? "Đang tải dữ liệu..." : "Chưa có dữ liệu"}
                </div>
              : <SensorChart rows={duLieuBieuDo} />}
          </div>
        </div>

        {/* Cột phụ: một thẻ chứa toàn bộ thiết bị và khung thiết lập ngưỡng. */}
        <aside className="dashboard-side">
          <section className={`dashboard-overview ${trangThaiMach}`} aria-label="Tóm tắt hệ thống">
            <div className="overview-art" aria-hidden="true"><Sun size={104} strokeWidth={1} /></div>
            <span className="overview-eyebrow">KHÔNG GIAN CỦA BẠN</span>
            <div className="overview-temperature">{formatSensorValue(duLieuCB.TEMPERATURE?.value)}<span>°C</span></div>
            <p><Droplet size={14} aria-hidden="true" /> Độ ẩm {formatSensorValue(duLieuCB.HUMIDITY?.value)}%</p>
            <div className="overview-status">
              {trangThaiMach === "connected" ? <Wifi size={15} aria-hidden="true" /> : <WifiOff size={15} aria-hidden="true" />}
              <span>{trangThaiMach === "connected" ? "Hệ thống đang hoạt động" : trangThaiMach === "loading" ? "Đang kiểm tra kết nối" : "Thiết bị chưa kết nối"}</span>
            </div>
          </section>
          <section className="dashboard-card device-panel">
            <div className="panel-heading">
              <h2 className="chart-title">Thiết bị</h2>
              <span className="panel-count">{(dsThietBi ?? []).length} thiết bị</span>
            </div>
            <div className="device-grid">
              {(dsThietBi ?? []).map((thietBi) => {
                const id = thietBi.deviceId;
                const dangBat = thietBi.status === "ON";
                const dangCho = idDangCapNhat === id || Boolean(thietBi.pendingActionId);
                const tenDen = thietBi.deviceName || `Đèn ${id}`;
                const status = dangCho ? "Đang chờ mạch..." : dangBat ? "Đang bật" : "Đang tắt";
                const sensor = DS_CAM_BIEN.find((cb) => cb.type ===
                  (Number(id) === 1 ? "TEMPERATURE" : Number(id) === 2 ? "HUMIDITY" : Number(id) === 3 ? "LIGHT" : null));
                const reading = sensor && duLieuCB[sensor.type];
                const dangCanhBao = trangThaiMach === "connected" && reading
                  && thoiDiemKiemTra - Date.parse(reading.createdAt) <= 10000
                  && Number(reading.value) > canhBao?.thresholds?.[sensor.type];

                return (
                  // Ô thiết bị: biểu tượng và công tắc cùng hàng, tên và trạng thái bên dưới.
                  <article className={`light-card${dangBat ? " is-on" : ""}${dangCanhBao ? " is-alert" : ""}`} key={id}>
                    <span className="light-icon" aria-hidden="true"><Lightbulb size={24} strokeWidth={2} /></span>
                    <div className="light-card-details">
                      <h3>{tenDen}</h3>
                      <span className={`light-card-status${dangCho ? " is-loading" : ""}`} role="status"
                        title={dangCanhBao ? `Cảnh báo ${sensor.title} · Đang nhấp nháy` : status}>
                        {dangCanhBao ? `Cảnh báo ${sensor.title} · nhấp nháy` : status}
                      </span>
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
              {/* Dòng thông báo khi chưa có thiết bị để hiển thị. */}
              {(dsThietBi === null || dsThietBi.length === 0) && (
                <p className="dashboard-device-empty" role="status">
                  {dsThietBi === null ? "Đang tải thiết bị..." : loiThietBi ? "Lỗi tải thiết bị. Không thể kết nối API." : "Chưa có thiết bị"}
                </p>
              )}
              {loiDieuKhien && <p className="dashboard-device-empty" role="alert">{loiDieuKhien}</p>}
            </div>
          </section>

          <div className={`dashboard-card threshold-card${dangChinhSuaNguong ? " is-editing" : ""}`}>
            <div className="threshold-heading">
              <h2 className="chart-title">Thiết lập ngưỡng</h2>
              <button className="threshold-edit-button" type="button"
                aria-label={dangChinhSuaNguong ? "Hủy chỉnh sửa ngưỡng" : "Chỉnh sửa ngưỡng"}
                disabled={!dangChinhSuaNguong && !canhBao?.thresholds}
                onClick={() => {
                  if (dangChinhSuaNguong) {
                    setDangChinhSuaNguong(false);
                  } else {
                    setNguongNhap(Object.fromEntries(DS_CAM_BIEN.map((cb) =>
                      [cb.type, String(canhBao.thresholds[cb.type] ?? "")])));
                    setDangChinhSuaNguong(true);
                  }
                }}>
                {dangChinhSuaNguong ? <X size={18} aria-hidden="true" /> : <Pencil size={18} aria-hidden="true" />}
              </button>
            </div>
            <div className="threshold-fields">
              {DS_CAM_BIEN.map((cb) => {
                const Icon = cb.icon;
                return (
                  <div className="threshold-field" key={cb.type}>
                    <span className={`threshold-icon ${cb.tone}`} aria-hidden="true">
                      <Icon size={20} strokeWidth={2} />
                    </span>
                    {dangChinhSuaNguong ? (
                      <>
                        <label htmlFor={`threshold-${cb.type}`}>{cb.title}</label>
                        <span className="threshold-input-wrap">
                          <input id={`threshold-${cb.type}`} type="number" step="0.01"
                            value={nguongNhap[cb.type] ?? ""}
                            onChange={(event) => setNguongNhap((current) =>
                              ({ ...current, [cb.type]: event.target.value }))} />
                          <span>{cb.unit}</span>
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="threshold-name">{cb.title}</span>
                        <span className="threshold-value">
                          <strong>{canhBao?.thresholds?.[cb.type] ?? "—"}</strong>
                          <span>{cb.unit}</span>
                        </span>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
            {dangChinhSuaNguong && (
              <div className="threshold-actions">
                <button type="button" disabled>Lưu</button>
                <p>Chưa thể lưu ngưỡng ở phiên bản này.</p>
              </div>
            )}
          </div>
          <p className="dashboard-update-note">{thoiGianDuLieu === null ? "Đang chờ số đo đầu tiên" : `Đồng bộ lần cuối: ${dinhdang(thoiGianDuLieu)}`}</p>
        </aside>
      </div>
    </MainLayout>
  );
}

export default Dashboard;
