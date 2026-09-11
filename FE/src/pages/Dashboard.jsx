import { useEffect, useState } from "react";

import MainLayout from "../layouts/MainLayout";
import { layDuLieuCB_sv } from "../service/dataSensorSV";
import { layThietBi_sv } from "../service/deviceSV";
import { ghiLichSu_sv } from "../service/historySV";
import { dinhdang } from "../configs/appConfig";
import { getMockChartRows } from "../mock/chartData";
import "../styles/Dashboard.css";

// Cấu hình cảm biến và thiết bị
const DS_CAM_BIEN = [
  { type: "TEMPERATURE", title: "Nhiệt độ", unit: "°C", icon: "🌡️", tone: "temperature" },
  { type: "HUMIDITY", title: "Độ ẩm", unit: "%", icon: "💧", tone: "humidity" },
  { type: "LIGHT", title: "Ánh sáng", unit: "%", icon: "☀️", tone: "light" },
];
const DEN_MAC_DINH = [{ deviceId: 1, deviceName: "Đèn 1" }, { deviceId: 2, deviceName: "Đèn 2" }];
const KEY_DU_LIEU_CB = "iot-dashboard-latest-v1";
const KEY_TRANG_THAI_DEN = "iot-dashboard-light-ui-v1";
const THOI_GIAN_CAP_NHAT = 15000;

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
function SensorChart({ rows, sensor }) {
  const yTren = 30;
  const yDuoi = 248;
  const dsGiaTri = rows.map((dong) => Number(dong.value));
  const giaTriMin = Math.min(...dsGiaTri);
  const giaTriMax = Math.max(...dsGiaTri);
  let khoang = giaTriMax - giaTriMin;
  if (khoang === 0) khoang = Math.max(giaTriMax * 0.1, 1);

  const trucMin = giaTriMin >= 0
    ? Math.max(0, giaTriMin - khoang * 0.2)
    : giaTriMin - khoang * 0.2;
  const trucMax = giaTriMax + khoang * 0.2;
  const dsThoiGian = rows.map((dong) => Date.parse(dong.createdAt));
  const thoiGianDau = dsThoiGian[0];
  const thoiGianCuoi = dsThoiGian[dsThoiGian.length - 1];
  const khoangThoiGian = thoiGianCuoi - thoiGianDau;
  const coTrucThoiGian = dsThoiGian.every(Number.isFinite) && khoangThoiGian > 0;

  function layX(index) {
    if (rows.length === 1) return 449;
    const tiLe = coTrucThoiGian
      ? (dsThoiGian[index] - thoiGianDau) / khoangThoiGian
      : index / (rows.length - 1);
    return 54 + tiLe * 790;
  }

  function layY(value) {
    return yDuoi - ((value - trucMin) / (trucMax - trucMin)) * (yDuoi - yTren);
  }

  const dsDiem = dsGiaTri.map((value, index) => `${layX(index)},${layY(value)}`);
  const duong = dsDiem.map((diem, index) => index === 0 ? `M ${diem}` : `L ${diem}`).join(" ");
  const vung = `${duong} L ${layX(rows.length - 1)},${yDuoi} L ${layX(0)},${yDuoi} Z`;
  const viTriGiua = Math.floor((rows.length - 1) / 2);
  const mocThoiGian = [...new Set([0, viTriGiua, rows.length - 1])];

  return (
    // Phần hình vẽ của biểu đồ: lưới, đường biểu diễn, các điểm và mốc thời gian.
    <svg className="dashboard-chart" viewBox="0 0 880 300" role="img"
      aria-label={`Biểu đồ ${sensor.title.toLowerCase()} theo thời gian`}>
      <defs>
        <linearGradient id="dashboard-chart-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.24" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.01" />
        </linearGradient>
      </defs>

      {[0, 1, 2, 3, 4].map((moc) => {
        const giaTri = trucMax - ((trucMax - trucMin) * moc) / 4;
        const viTriY = yTren + moc * ((yDuoi - yTren) / 4);
        return (
          <g className="dashboard-chart-grid" key={moc}>
            <line x1="54" x2="844" y1={viTriY} y2={viTriY} />
            <text x="44" y={viTriY + 4} textAnchor="end">
              {giaTri.toLocaleString("vi-VN", { maximumFractionDigits: 1 })}
            </text>
          </g>
        );
      })}

      <path d={vung} fill="url(#dashboard-chart-fill)" />
      <path d={duong} fill="none" stroke="currentColor" strokeWidth="3"
        strokeLinecap="round" strokeLinejoin="round" />

      {dsGiaTri.map((value, index) => (
        <circle key={index} cx={layX(index)} cy={layY(value)} r="4.5"
          fill="white" stroke="currentColor" strokeWidth="2.5" />
      ))}

      {mocThoiGian.map((index) => {
        let canLe = "middle";
        if (rows.length > 1 && index === 0) canLe = "start";
        else if (rows.length > 1 && index === rows.length - 1) canLe = "end";

        return (
          <text className="dashboard-chart-time" key={index}
            x={layX(index)} y="282" textAnchor={canLe}>
            {dinhdang(rows[index].createdAt)}
          </text>
        );
      })}
    </svg>
  );
}

// Dashboard chính
function Dashboard() {
  const [duLieuCB, setDuLieuCB] = useState(docDuLieuCBGanNhat);
  const [loaiDangChon, setLoaiDangChon] = useState("TEMPERATURE");
  const [dsThietBi, setDsThietBi] = useState(DEN_MAC_DINH);
  const [trangThaiThietBi, setTrangThaiThietBi] = useState("loading");
  const [trangThaiDen, setTrangThaiDen] = useState(docObject(KEY_TRANG_THAI_DEN));
  const [idDangCapNhat, setIdDangCapNhat] = useState(null);

  // Lấy dữ liệu cảm biến và tự cập nhật định kỳ
  useEffect(() => {
    let dangMoTrang = true;

    async function capNhatCamBien() {
      const requests = DS_CAM_BIEN.map((cb) => layDuLieuCB_sv(1, 1, { type: cb.type }));
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
  const camBienDangChon = DS_CAM_BIEN.find((cb) => cb.type === loaiDangChon);
  const duLieuBieuDo = getMockChartRows(loaiDangChon);

  // Giao diện
  return (
    <MainLayout title="Dashboard" description="Tổng quan dữ liệu cảm biến và trạng thái thiết bị">
      <div className="dashboard">
        {/* Cụm thẻ cảm biến: tiêu đề và ba ô nhiệt độ, độ ẩm, ánh sáng. */}
        <section className="dashboard-section">
          <div className="dashboard-section-heading"><h2>Dữ liệu cảm biến</h2></div>
          <div className="dashboard-grid">
            {DS_CAM_BIEN.map((cb) => {
              const moiNhat = duLieuCB[cb.type];

              return (
                // Bên trái là chỉ số; bên phải là tên cảm biến và biểu tượng.
                <article className={`dashboard-card sensor-card ${cb.tone}`} key={cb.type}>
                  <div className="sensor-reading">
                    <strong>{moiNhat ? Number(moiNhat.value).toLocaleString("vi-VN", { maximumFractionDigits: 1 }) : "--"}</strong>
                    <span>{moiNhat?.unit || cb.unit}</span>
                  </div>
                  <div className="sensor-card-info">
                    <span className="sensor-card-label">{cb.title}</span>
                    <span className="sensor-icon" aria-hidden="true">{cb.icon}</span>
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
              let status = dangBat ? "Đang bật" : "Đang tắt";
    
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
            {dsThietBi.length === 0 && (
              <p className="dashboard-device-empty">
                {trangThaiThietBi === "offline" ? "Không thể tải danh sách thiết bị" : "Đang tải thiết bị..."}
              </p>
            )}
          </div>
        </section>

        {/* Cụm biểu đồ: tiêu đề, các nút chọn cảm biến và khung biểu đồ. */}
        <section className="dashboard-section">
          <div className="dashboard-section-heading chart-section-heading">
            <h2>Biểu đồ dữ liệu</h2>
            {/* Các nút chuyển loại cảm biến đang xem trên biểu đồ. */}
            <div className="chart-tabs" role="group" aria-label="Chọn cảm biến cho biểu đồ">
              {DS_CAM_BIEN.map((cb) => {
                const dangChon = loaiDangChon === cb.type;
                return (
                  <button className={dangChon ? "selected" : ""} key={cb.type}
                    type="button" aria-pressed={dangChon} onClick={() => setLoaiDangChon(cb.type)}>
                    {cb.title}
                  </button>
                );
              })}
            </div>
          </div>
          {/* Khung biểu đồ gồm tên, đơn vị và hình vẽ SensorChart. */}
          <div className={`dashboard-card chart-card ${camBienDangChon.tone}`}>
            <div className="chart-card-heading">
              <strong>{camBienDangChon.title}</strong>
              <span>Đơn vị: {camBienDangChon.unit}</span>
            </div>
            <SensorChart rows={duLieuBieuDo} sensor={camBienDangChon} />
          </div>
        </section>
      </div>
    </MainLayout>
  );
}

export default Dashboard;
